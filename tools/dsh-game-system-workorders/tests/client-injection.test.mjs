import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { Context, Service } from '@deepseek-ai/cordis';
import { clientSource } from '../scripts/client-source.mjs';

test('real Cordis reproduces undeclared Remote access while optional lookup is allowed', async () => {
  const root = new Context();
  class Remote extends Service {
    constructor(ctx) { super(ctx, 'remote'); }
    get gameWorkorders() { return this.ctx['remote.gameWorkorders']; }
  }
  new Remote(root);
  const provider = await root.plugin({ apply(ctx) { ctx.provide('remote.gameWorkorders', { marker: true }); } });
  const fiber = await root.plugin({ inject: ['remote'], apply(ctx) {
    assert.throws(() => ctx.remote.gameWorkorders, /cannot get property "remote.gameWorkorders" without inject/);
    assert.equal(ctx.get('remote.gameWorkorders').marker, true);
  } });
  await fiber.dispose();
  await provider.dispose();
});

test('production Client reads dynamically mounted queries under the real dependency guard without command history', async () => {
  const root = new Context();
  const calls = [];
  let mounts = 0;
  let queryProvider;
  const queries = Object.fromEntries(['discover', 'snapshot', 'document'].map(action => [action, async (...args) => {
    calls.push([action, ...args]); return { ok: true, value: { action } };
  }]));
  class Remote extends Service {
    constructor(ctx) { super(ctx, 'remote'); }
    get gameWorkorders() { return this.ctx['remote.gameWorkorders']; }
    get commands() { return this.ctx['remote.commands']; }
    async $mount() {
      mounts++;
      queryProvider = await root.plugin({ apply(ctx) { ctx.provide('remote.gameWorkorders', queries); } });
      this.ctx.effect(() => () => queryProvider.dispose());
    }
  }
  new Remote(root);
  root.provide('remote.commands', { execute() { throw new Error('Queries must not append command history'); } });
  root.provide('locale', { register() { return () => {}; }, bind() { return key => key; } });
  root.provide('slots', { inject() { return () => {}; } });
  let plugin;
  const sandbox = {
    window: { __ModuleLoader__: { load(module) { plugin = module.factory(() => ({})); } } },
  };
  const source = (await clientSource()).replace('        function button(', '        globalThis.testApi = { storeFor, command };\n        function button(');
  vm.runInNewContext(source, sandbox);
  assert.equal(plugin.inject.includes('remote.gameWorkorders'), false, 'Waiting for the namespace before mounting it would deadlock activation');
  const fiber = await root.plugin(plugin);
  try {
    assert.equal(mounts, 1);
    const store = sandbox.testApi.storeFor('session-test');
    for (const action of ['discover', 'snapshot', 'document']) {
      const response = await sandbox.testApi.command(store, 'game-tickets', { action, ...(action === 'discover' ? {} : { root: 'root', ...(action === 'document' ? { file: 'file' } : {}) }) });
      assert.equal(response.data.action, action);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['discover', 'session-test', {}], ['snapshot', 'session-test', 'root'], ['document', 'session-test', 'root', 'file']]);
    await queryProvider.dispose();
    await assert.rejects(sandbox.testApi.command(store, 'game-tickets', { action: 'discover' }), /queryUnavailable/);
    assert.equal(calls.length, 3, 'An unavailable query provider must not fall back to command history or model execution');
  } finally { await fiber.dispose(); }
});
