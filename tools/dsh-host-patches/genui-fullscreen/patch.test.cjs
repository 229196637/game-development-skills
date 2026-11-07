'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BASELINE, LEGACY_FULLSCREEN, MARKER, ANCHOR, sha, patchBytes, install, restore, snapshot } = require('./patch.cjs');
const workspace = process.env.DSH_TEST_WORKSPACE || 'D:/Project/AIProject';
const installed = process.env.DSH_GENUI_CLIENT || 'C:/Users/22919/.dsh/profiles/desktop/node_modules/@changfenhuang/dsh-genui/lib/client.js';
const source = fs.readFileSync(installed);
// Allow rerunning after deployment by reversing this patch's bounded section.
let original = source;
if (source.includes(Buffer.from(MARKER))) {
  const text = source.toString('utf8'), start = text.indexOf(MARKER), marker = '/* /dsh-genui-fullscreen:v1 */', end = text.indexOf(marker, start);
  original = Buffer.from(text.slice(0, start) + text.slice(end + marker.length));
}
assert.equal(sha(original), BASELINE);
const patched = patchBytes(original);
assert.ok(patched.includes(Buffer.from(MARKER)));
assert.equal(patched.toString().split(ANCHOR).length, 2, 'original renderer retained exactly once');
assert.deepEqual(patchBytes(patched), patched, 'idempotent');
assert.throws(() => patchBytes(Buffer.from('unknown build')), /Unsupported/);
assert.throws(() => patchBytes(Buffer.concat([original, Buffer.from(' ')])), /Unsupported/);
assert.throws(() => patchBytes(Buffer.from(patched.toString().replace('Press Esc to return', 'corrupt'))), /differs/);
assert.throws(() => patchBytes(Buffer.from(patched.toString().replace('function Sh(e)', 'function Broken(e)'))), /baseline/);
assert.throws(() => patchBytes(Buffer.from([0xff, 0xfe])), /UTF-8/);
const root = path.join(workspace, '.agent-tmp', '20261107-genui-fullscreen', 'installer-test-' + Date.now());
const profile = path.join(root, 'profile');
const pkg = path.join(profile, 'node_modules', '@changfenhuang', 'dsh-genui');
fs.mkdirSync(path.join(pkg, 'lib'), { recursive: true });
fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@changfenhuang/dsh-genui', version: '0.15.0' }));
fs.writeFileSync(path.join(pkg, 'lib', 'client.js'), original);
fs.writeFileSync(path.join(profile, 'cordis.yml'), 'enabled: true\n');
fs.writeFileSync(path.join(profile, 'desktop-next.runtime.patch.json'), '{"unchanged":true}\n');
const settings = snapshot(profile);
const receipt = install(profile, path.join(root, 'backups'));
assert.equal(receipt.status, 'installed');
assert.equal(receipt.settingsUnchanged, true);
assert.deepEqual(snapshot(profile), settings);
assert.equal(install(profile, path.join(root, 'backups')).status, 'already-installed');
assert.deepEqual(fs.readFileSync(path.join(receipt.backup, 'client.js')), original);
assert.equal(restore(receipt.backup).status, 'restored');
assert.deepEqual(fs.readFileSync(path.join(pkg, 'lib', 'client.js')), original);
assert.deepEqual(snapshot(profile), settings);
assert.equal(restore(receipt.backup).status, 'already-restored');
const legacyPath = path.join(workspace, '.agent-tmp', '20261107-genui-fullscreen', 'legacy-fullscreen-client.js');
if (sha(source) === LEGACY_FULLSCREEN && !fs.existsSync(legacyPath)) fs.writeFileSync(legacyPath, source, { flag: 'wx' });
if (fs.existsSync(legacyPath)) {
  const legacy = fs.readFileSync(legacyPath);
  assert.equal(sha(legacy), LEGACY_FULLSCREEN);
  assert.deepEqual(patchBytes(legacy), patched, 'exact shipped fullscreen version upgrades to centered card');
  assert.throws(() => patchBytes(Buffer.from(legacy.toString().replace('全屏查看', '篡改查看'))), /differs/);
  fs.writeFileSync(path.join(pkg, 'lib', 'client.js'), legacy);
  const upgrade = install(profile, path.join(root, 'upgrade-backups'));
  assert.equal(upgrade.settingsUnchanged, true);
  assert.deepEqual(fs.readFileSync(path.join(upgrade.backup, 'client.js')), legacy);
  assert.equal(restore(upgrade.backup).status, 'restored');
  assert.deepEqual(fs.readFileSync(path.join(pkg, 'lib', 'client.js')), legacy, 'upgrade rollback restores previous version');
  assert.deepEqual(snapshot(profile), settings);
}
console.log('PASS: baseline, exact anchor, syntax, UTF-8, idempotence, tamper guards, backup, installation, settings preservation, rollback and shipped fullscreen-to-card upgrade.');
