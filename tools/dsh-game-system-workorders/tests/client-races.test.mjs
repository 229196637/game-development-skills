import test from 'node:test';
import assert from 'node:assert/strict';
import { clientSource } from '../scripts/client-source.mjs';
import vm from 'node:vm';

const source = await clientSource();
async function harness() {
  const pending = [];
  const listeners = new Map();
  let installed;
  const query = input => new Promise(resolve => pending.push({ input, resolve(data) { resolve({ ok: true, value: data }); } }));
  const context = {
    window: { __ModuleLoader__: { load(module) {
      const plugin = module.factory(() => ({ createElement() {}, useState(value) { return [value, () => {}]; }, useEffect() {} }));
      installed = plugin.apply({
        locale: { register() { return () => {}; }, bind() { return key => key; } },
        effect(effect) { effect(); },
        on(name, callback) { listeners.set(name, callback); },
        slots: { inject() {} },
        get(key) { assert.equal(key, 'remote.gameWorkorders'); return this.remote.gameWorkorders; },
        remote: {
          async $mount() {},
          gameWorkorders: {
            discover(_session, options) { return query({ action: 'discover', ...options }); },
            snapshot(_session, root) { return query({ action: 'snapshot', root }); },
            document(_session, root, file) { return query({ action: 'document', root, file }); },
          },
          commands: { execute() { throw new Error('Read-only queries must not append command history'); } },
        },
      });
    } } },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { visibilityState: 'visible' }, setInterval, clearInterval,
  };
  vm.runInNewContext(source.replace('        function button(', '        globalThis.gwoTest = { storeFor, select, discover, readDocument, closeDocument, adoptSnapshot };\n        function button('), context);
  await installed;
  return { ...context.gwoTest, pending, listeners };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('native snapshot B invalidates pending selection A and its old document/confirmation', async () => {
  const app = await harness(); const store = app.storeFor('s');
  const selecting = app.select(store, 'A');
  app.listeners.get('command/executed')('s', 'game-tickets', { kind: 'success', text: JSON.stringify({ protocol: 'game-workorders/1', action: 'snapshot', data: { root: 'B' } }) });
  app.pending[0].resolve({ root: 'A' }); await selecting;
  assert.equal(store.root, 'B'); assert.equal(store.snapshot.root, 'B');
  assert.equal(store.confirmation, null); assert.equal(store.doc, null);
});

test('documents cannot cross task boundaries, overwrite a newer document, or reopen after close', async () => {
  const app = await harness(); const store = app.storeFor('s');
  app.adoptSnapshot(store, { root: 'A' });
  const old = app.readDocument(store, 'A.md');
  app.adoptSnapshot(store, { root: 'B' });
  app.pending[0].resolve({ file: 'A.md' }); await old;
  assert.equal(store.doc, null);
  const first = app.readDocument(store, 'B1.md'); const second = app.readDocument(store, 'B2.md');
  app.pending[2].resolve({ file: 'B2.md' }); await second;
  app.pending[1].resolve({ file: 'B1.md' }); await first;
  assert.equal(store.doc.file, 'B2.md');
  const closed = app.readDocument(store, 'B3.md'); app.closeDocument(store);
  app.pending[3].resolve({ file: 'B3.md' }); await closed;
  assert.equal(store.doc, null); assert.equal(store.loading, 0);
});

test('latest discovery wins and an empty result invalidates prior selection', async () => {
  const app = await harness(); const store = app.storeFor('s');
  const older = app.discover(store, { directory: 'old' }); const newer = app.discover(store, { directory: 'new' });
  app.pending[1].resolve({ cwd: 'new', tasks: [] }); await newer;
  app.pending[0].resolve({ cwd: 'old', tasks: [] }); await older;
  assert.equal(store.discovery.cwd, 'new');
  const selecting = app.select(store, 'A'); const clearing = app.discover(store);
  app.pending[3].resolve({ cwd: 'empty', tasks: [] }); await clearing;
  app.pending[2].resolve({ root: 'A' }); await selecting;
  assert.equal(store.root, ''); assert.equal(store.snapshot, null); assert.equal(store.loading, 0);
});

test('discovery never undoes a selection made while scanning', async () => {
  const app = await harness(); const store = app.storeFor('s');
  const scanning = app.discover(store);
  const selecting = app.select(store, 'B');
  app.pending[1].resolve({ root: 'B' }); await selecting;
  app.pending[0].resolve({ cwd: 'project', tasks: [{ root: 'A' }] }); await scanning; await tick();
  assert.equal(store.root, 'B'); assert.equal(store.snapshot.root, 'B'); assert.equal(app.pending.length, 2);
});
