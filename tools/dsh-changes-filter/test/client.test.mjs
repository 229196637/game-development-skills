import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

/**
 * The client half is a plain browser script: it hands its module to
 * `window.__ModuleLoader__`. Stub that (and `require`) so node can load it and
 * reach the `__internals` helpers without a browser.
 */
async function loadClientInternals() {
  const react = {
    createElement() {},
    useEffect() {},
    useState() {},
    useSyncExternalStore() {},
  };
  let module = null;
  globalThis.window = {
    __ModuleLoader__: {
      load(descriptor) {
        module = descriptor.factory((id) => {
          if (id === 'react') return react;
          throw new Error(`unexpected require: ${id}`);
        });
      },
    },
  };
  const url = pathToFileURL(path.join(import.meta.dirname, '..', 'client.js')).href;
  await import(`${url}?t=${Date.now()}`);
  assert.ok(module !== null, 'client module did not register itself');
  assert.ok(module.__internals !== undefined, 'client module exposes no __internals');
  return module.__internals;
}

test('client half exposes the pure helper functions', async () => {
  const internals = await loadClientInternals();
  assert.equal(typeof internals.isHidden, 'function');
  assert.equal(typeof internals.groupFiles, 'function');
  assert.equal(typeof internals.parseLines, 'function');
});

test('client parseLines trims and drops blank lines', async () => {
  const internals = await loadClientInternals();
  assert.deepEqual(internals.parseLines('docs\r\n\r\n  res/Atlas  \n'), ['docs', 'res/Atlas']);
  assert.deepEqual(internals.parseLines(''), []);
});

test('client normalizeIncoming mirrors the host normalization', async () => {
  const internals = await loadClientInternals();
  assert.deepEqual(
    internals.normalizeIncoming({ dirs: ['./Docs/', 'docs'], exts: ['META', '.png'] }),
    { dirs: ['docs'], exts: ['.meta', '.png'] },
  );
  assert.deepEqual(internals.normalizeIncoming(undefined), { dirs: [], exts: [] });
  assert.deepEqual(internals.normalizeIncoming({ dirs: 'docs' }), { dirs: [], exts: [] });
});

test('client summaryKey separates sessions', async () => {
  const internals = await loadClientInternals();
  assert.equal(internals.summaryKey('s1', 3), 's1:3');
  assert.notEqual(internals.summaryKey('s1', 3), internals.summaryKey('s2', 3));
});

test('client relPath and isHidden agree with the host rules', async () => {
  const internals = await loadClientInternals();
  const cwd = 'D:\\Project\\GameProject\\dahuaxiyou';
  assert.equal(internals.relPath('D:\\Project\\GameProject\\dahuaxiyou\\docs\\a.md', cwd), 'docs/a.md');
  const rules = { dirs: ['docs'], exts: ['.meta'] };
  assert.equal(internals.isHidden('docs/a.md', rules), true);
  assert.equal(internals.isHidden('src/a.lua', rules), false);
});

test('client dedupePresented keeps the latest path before the closing reply', async () => {
  const internals = await loadClientInternals();
  const data = {
    presented: [
      { path: 'a.md', seq: 2 },
      { path: 'b.md', seq: 3 },
      { path: 'a.md', seq: 5 },
      { path: 'c.md', seq: 9 },
      { path: 42 },
    ],
  };
  const kept = internals.dedupePresented(data, 9);
  assert.deepEqual(kept.map((file) => file.path), ['a.md', 'b.md']);
  assert.equal(kept[0].seq, 5);
  assert.deepEqual(internals.dedupePresented(null, 1), []);
  assert.deepEqual(internals.dedupePresented({ presented: 'nope' }, 1), []);
});
