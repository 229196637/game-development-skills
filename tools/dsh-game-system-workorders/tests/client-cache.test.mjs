import test from 'node:test';
import assert from 'node:assert/strict';
import { clientSource } from '../scripts/client-source.mjs';
import vm from 'node:vm';

const source = await clientSource();
const CACHE_KEY = 'dsh-game-workorders/snapshot/v1';

function memoryStorage(seed = {}) {
  const items = new Map(Object.entries(seed));
  return {
    items,
    getItem(key) { return items.has(key) ? items.get(key) : null; },
    setItem(key, value) { items.set(key, String(value)); },
    removeItem(key) { items.delete(key); },
  };
}

async function harness({ storage = memoryStorage() } = {}) {
  const pending = [];
  const commands = [];
  let installed;
  const query = input => new Promise(resolve => pending.push({ input, resolve(data) { resolve({ ok: true, value: data }); } }));
  const context = {
    window: { __ModuleLoader__: { load(module) {
      const plugin = module.factory(() => ({ createElement() {}, useState(value) { return [value, () => {}]; }, useEffect() {} }));
      installed = plugin.apply({
        locale: { register() { return () => {}; }, bind() { return key => key; } },
        effect(effect) { effect(); },
        on() {},
        slots: { inject() {}, register() { return () => {}; } },
        style() { return ''; },
        get(key) { return key === 'remote.gameWorkorders' ? this.remote.gameWorkorders : undefined; },
        remote: {
          async $mount() {},
          gameWorkorders: {
            discover(_session, options) { return query({ action: 'discover', ...options }); },
            snapshot(_session, root) { return query({ action: 'snapshot', root }); },
            document(_session, root, file) { return query({ action: 'document', root, file }); },
          },
          commands: {
            async execute(_session, line) {
              commands.push(line);
              return { ok: true, value: { commandId: 'c1', result: { kind: 'success', text: JSON.stringify({ protocol: 'game-workorders/1', action: 'start', data: { accepted: true } }) } } };
            },
          },
        },
      });
    } } },
    localStorage: storage,
    document: { visibilityState: 'visible' }, setInterval, clearInterval, Date, Math, JSON, console,
  };
  vm.runInNewContext(source.replace('        function button(', '        globalThis.gwoTest = { storeFor, select, discover, readDocument, closeDocument, adoptSnapshot, hydrateSnapshot, rememberSnapshot, start };\n        function button('), context);
  await installed;
  return { ...context.gwoTest, pending, commands, storage };
}

const snapshot = (root, extra = {}) => ({ root, counts: { todo: 1, doing: 0, blocked: 0, completed: 0, total: 1 }, tasks: [{ id: 'A', status: 'todo' }], ...extra });
const seed = (root, at = 1000) => memoryStorage({
  [CACHE_KEY]: JSON.stringify({ v: 1, entries: { [root]: { at, schemaVersion: 1, snapshot: snapshot(root) } } }),
  // A prior successful selection also remembers the root for this session.
  [`gwo:root:s`]: root,
});

test('a remembered root paints from cache with a stale marker and no query', async () => {
  const app = await harness({ storage: seed('R') });
  const store = app.storeFor('s');
  const root = app.hydrateSnapshot(store);
  assert.equal(root, 'R');
  assert.equal(store.snapshot.counts.todo, 1);
  assert.equal(store.stale, true);
  assert.equal(store.cachedAt, 1000);
  assert.equal(app.pending.length, 0, 'painting the cache must not call the host');
});

test('a successful revalidation stores the snapshot and clears the stale flag', async () => {
  const app = await harness();
  const store = app.storeFor('s');
  const selecting = app.select(store, 'R');
  app.pending[0].resolve(snapshot('R', { counts: { todo: 2 } }));
  await selecting;
  assert.equal(store.stale, false);
  assert.equal(store.cachedAt, null);
  const saved = JSON.parse(app.storage.getItem(CACHE_KEY));
  assert.equal(saved.entries.R.snapshot.counts.todo, 2);
  // Reopening the panel in the same session (same browser storage) paints instantly.
  const reopened = await harness({ storage: app.storage });
  const next = reopened.storeFor('s');
  assert.equal(reopened.hydrateSnapshot(next), 'R');
  assert.equal(next.snapshot.counts.todo, 2);
  assert.equal(next.stale, true);
});

test('corrupt, oversized and surplus cache entries are ignored or pruned', async () => {
  const corrupt = await harness({ storage: memoryStorage({ [CACHE_KEY]: '{not json' }) });
  assert.doesNotThrow(() => corrupt.hydrateSnapshot(corrupt.storeFor('s')));
  const oversized = await harness();
  const big = oversized.rememberSnapshot('BIG', snapshot('BIG', { blob: 'x'.repeat(600 * 1024) }));
  assert.equal(big, undefined);
  assert.equal(oversized.storage.getItem(CACHE_KEY), null, 'oversized snapshots are never written');
  const surplus = await harness();
  for (const root of ['A', 'B', 'C', 'D', 'E']) surplus.rememberSnapshot(root, snapshot(root));
  const kept = Object.keys(JSON.parse(surplus.storage.getItem(CACHE_KEY)).entries);
  assert.equal(kept.length, 4);
  assert.deepEqual(kept.includes('A'), false, 'oldest entry is pruned');
});

test('a stale snapshot blocks execution but never blocks planning', async () => {
  const app = await harness({ storage: seed('R') });
  const store = app.storeFor('s');
  app.hydrateSnapshot(store);
  await app.start(store, 'execute', 'R');
  assert.equal(store.error, 'validating');
  assert.equal(store.pending, false);
  assert.equal(app.commands.length, 0, 'a cached snapshot must not queue execution');
  await app.start(store, 'plan', '需要新功能');
  assert.equal(app.commands.length, 1, 'planning does not depend on the cached snapshot');
  assert.equal(store.status, 'queued');
});
