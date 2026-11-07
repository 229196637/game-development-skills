import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clientSource } from '../scripts/client-source.mjs';
import { apply } from '../src/host/plugin.js';

const client = await clientSource();

test('Host registration follows ToolDefinition inheritance and all contributions dispose', () => {
  const commands = [];
  const tools = [];
  const cleanup = [];
  let active = 0;
  apply({
    effect(callback) { cleanup.push(callback()); },
    commands: { register(value) { commands.push(value); active++; return () => active--; } },
    tools: { register(value) {
      assert.equal(value.name, 'game_workorders');
      assert.equal(value.parameters.type, 'object');
      assert.equal(value.schema, undefined, 'ToolDefinition extends ToolSchema instead of nesting schema');
      assert.equal(typeof value.output.render, 'function');
      tools.push(value); active++; return () => active--;
    } },
  });
  assert.deepEqual(commands.map(command => command.name), ['game-tickets', 'game-execute', 'game-plan']);
  assert.equal(tools.length, 1);
  cleanup.reverse().forEach(dispose => dispose());
  assert.equal(active, 0);
});

async function installedClient() {
  const registrations = [];
  const effects = [];
  const listeners = new Map();
  let exported;
  let active = 0;
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) { return [initial, () => {}]; },
    useEffect() {},
  };
  vm.runInNewContext(client, {
    window: { __ModuleLoader__: { load(module) { assert.equal(module.id, '@local/dsh-game-system-workorders'); exported = module.factory(name => { assert.equal(name, 'react'); return React; }); } } },
    document: { visibilityState: 'visible' },
    localStorage: { getItem() { return null; }, setItem() {} },
    setInterval, clearInterval,
  });
  await exported.apply({
    locale: {
      register(namespace, locale, dictionary) { assert.equal(namespace, 'game-workorders'); assert.ok(['zh', 'en'].includes(locale)); assert.equal(typeof dictionary.title, 'string'); active++; return () => active--; },
      bind() { return key => key; },
      subscribe() { return () => {}; },
    },
    effect(callback) { effects.push(callback()); },
    on(name, listener) { listeners.set(name, listener); effects.push(() => listeners.delete(name)); },
    remote: { async $mount() {}, commands: { async execute() { throw new Error('unexpected remote during registration'); } } },
    slots: {
      inject(_slot, callback) { effects.push(callback()); },
      register(options, component) { registrations.push({ options, component }); active++; return () => active--; },
    },
  });
  return { exported, registrations, listeners, cleanup() { effects.reverse().forEach(dispose => dispose?.()); assert.equal(active, 0); } };
}

test('Client installs unique native slots, uses host React, and disposes all contributions', async () => {
  const app = await installedClient();
  assert.ok(app.exported.inject.includes('remote.commands'));
  assert.equal(app.registrations.length, 5);
  assert.deepEqual(app.registrations.filter(row => row.options.key).map(row => row.options.key), ['game-tickets', 'game-execute', 'game-plan']);
  assert.ok(app.registrations.every(row => row.options.id === 'game-system-workorders' || row.options.key));
  app.cleanup();
});

test('Client composer reads documented InputState and command cards handle missing/running/error outcomes', async () => {
  const app = await installedClient();
  const composer = app.registrations.find(row => row.options.name === 'conversation.composer.dock');
  const tree = composer.component({ sessionId: 's', useInput: selector => selector({ draft: '/game-execute', draftRev: 1, phase: 'editing', occurrences: [], attachmentIds: [] }), inputActions: {} });
  assert.equal(tree.type, 'div');
  const card = app.registrations.find(row => row.options.key === 'game-tickets');
  for (const outcome of [null, { kind: 'error', text: 'visible failure' }, { kind: 'success', text: '{"protocol":"game-workorders/1","action":"discover","data":{"tasks":[]}}' }]) {
    assert.doesNotThrow(() => card.component({ sessionId: 's', node: { kind: 'command', name: 'game-tickets', outcome } }));
  }
  app.cleanup();
});
