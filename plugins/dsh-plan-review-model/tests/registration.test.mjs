import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Static ownership regression, not a fake React renderer or browser test.
// A duplicate child declaration broke native question UI activation in v1.
const base = new URL('../', import.meta.url);
const client = await readFile(new URL('client.js', base), 'utf8');
const manifest = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
const patch = await readFile(new URL('cordis.patch.yml', base), 'utf8');

test('composer replacement never redeclares or renders native-owned child slots', () => {
  assert.doesNotMatch(client, /\bchildren\s*:/);
  assert.doesNotMatch(client, /\brenderSlot\s*\(/);
  assert.match(client, /ctx\.sidebarRight\.openResource\('dsh-resource:\/\/plan\//);
  assert.match(client, /priority:\s*-5/);
});

test('Client loader, bundle patch, manifest and display resources agree', async () => {
  assert.ok(client.includes(`id: '${manifest.name}'`));
  assert.ok(patch.includes(`name: '${manifest.name}'`));
  for (const locale of ['zh', 'en']) {
    const dictionary = JSON.parse(await readFile(new URL(`locale/${locale}.json`, base), 'utf8'));
    assert.ok(dictionary.meta.title.length > 0);
    assert.ok(dictionary.meta.description.length > 0);
  }
  const svg = await readFile(new URL(manifest.exports['./icon'], base), 'utf8');
  assert.match(svg, /^<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(Buffer.byteLength(svg) < 262144);
});

test('Client declares every accessed service root, including remote itself', () => {
  const declaration = client.match(/inject:\s*\[([^\]]+)\]/);
  assert.ok(declaration, 'Client must declare its service dependencies');
  const dependencies = [...declaration[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const roots = new Set([...client.matchAll(/\bctx\.([a-zA-Z]+)\./g)].map(match => match[1]));
  assert.ok(roots.has('remote'));
  for (const root of roots) {
    assert.ok(dependencies.includes(root), `missing root service injection: ${root}`);
  }
  assert.ok(dependencies.includes('remote.commands'));
});

test('approval text uses a readable semantic token and errors have visible details', () => {
  const primary = client.match(/\.pem-primary\{([^}]+)\}/)?.[1];
  assert.ok(primary);
  assert.match(primary, /(?:^|;)color:var\(--dsw-alias-label-primary\)/);
  assert.doesNotMatch(primary, /(?:^|;)color:var\(--dsw-alias-bg-base\)/);
  assert.match(client, /h\('details', null, h\('summary', null, t\('details'\)\), loadError\)/);
});

test('dynamic Client imports only React and no internal Harness Client modules', () => {
  const requires = [...client.matchAll(/require\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(requires, ['react']);
  assert.doesNotMatch(client, /\b(document|localStorage|sessionStorage)\./);
});
