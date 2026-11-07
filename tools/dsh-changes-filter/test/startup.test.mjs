import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const TAIL = 'conversation.chat.turnTail';
const NATIVE_ID = '@deepseek-ai/dsh-client-ui-deliverables';
const ACTIONS = 'deliverables.file.actions';
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');

function loadClient(code = source) {
  let plugin;
  const requests = [];
  vm.runInNewContext(code, {
    URLSearchParams,
    fetch: async (...args) => {
      requests.push(args);
      return { ok: true, json: async () => ({ dirs: [], exts: [] }) };
    },
    window: { __ModuleLoader__: { load(descriptor) {
      assert.equal(descriptor.id, 'dsh-changes-filter');
      plugin = descriptor.factory((id) => {
        assert.equal(id, 'react');
        return { createElement() {}, useEffect() {}, useState() {}, useSyncExternalStore() {} };
      });
    } } },
  }, { filename: 'dsh-changes-filter/client.js' });
  assert.equal(typeof plugin.apply, 'function');
  return { plugin, requests };
}

/**
 * Narrow, strict Service contract harness, NOT a real Cordis/React/Web boot.
 * Matches the installed SlotCore list collision rule (lib/index.js:163-184),
 * lowest-priority-per-id projection (:278-292), and the Service's synchronous
 * declaration-scoped inject/caller-owned disposal contract. It deliberately
 * rejects the old registration instead of permissively accepting any call.
 */
function createSlots() {
  const declarations = new Set();
  const cells = new Map();
  const injections = new Set();

  function sync(injection) {
    if (declarations.has(injection.key)) {
      if (injection.active === undefined) injection.active = injection.setup();
    } else {
      const dispose = injection.active;
      injection.active = undefined;
      dispose?.();
    }
  }
  function declare(key) {
    assert.equal(declarations.has(key), false, `duplicate declaration: ${key}`);
    declarations.add(key);
    for (const injection of [...injections]) if (injection.key === key) sync(injection);
  }
  function collapse(key) {
    declarations.delete(key);
    for (const injection of [...injections]) if (injection.key === key) sync(injection);
    cells.delete(key);
  }
  function register(owner, options, component) {
    assert.ok(declarations.has(options.name), 'slot must be declared');
    assert.equal(typeof options.id, 'string', 'list entries require an id');
    const entries = cells.get(options.name) ?? [];
    const priority = options.priority ?? 0;
    if (entries.some((entry) => entry.options.id === options.id && (entry.options.priority ?? 0) === priority)) {
      throw new Error(`list slot "${options.name}" already has an entry with id "${options.id}" at priority ${priority}`);
    }
    for (const child of Object.keys(options.children ?? {})) {
      assert.equal(declarations.has(child), false, `duplicate child: ${child}`);
    }
    const entry = { owner, options, component };
    entries.push(entry);
    cells.set(options.name, entries);
    for (const child of Object.keys(options.children ?? {})) declare(child);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const current = cells.get(options.name);
      if (current?.includes(entry)) current.splice(current.indexOf(entry), 1);
      for (const child of Object.keys(options.children ?? {})) collapse(child);
    };
  }
  function context(owner) {
    const disposers = [];
    const dictionaries = new Map();
    const listeners = new Map();
    const ctx = {
      effect(setup) {
        const dispose = setup();
        assert.equal(typeof dispose, 'function', 'test effect must return a disposer');
        disposers.push(dispose);
        return dispose;
      },
      on(event, listener) {
        listeners.set(event, listener);
        const dispose = () => listeners.delete(event);
        disposers.push(dispose);
        return dispose;
      },
      locale: { register(namespace, language, dictionary) {
        const key = `${namespace}:${language}`;
        assert.equal(dictionaries.has(key), false);
        dictionaries.set(key, dictionary);
        return () => dictionaries.delete(key);
      } },
      slots: {
        register(options, component) {
          return ctx.effect(() => register(owner, options, component));
        },
        inject(key, setup) {
          const injection = { key, setup, active: undefined };
          injections.add(injection);
          const dispose = () => {
            injections.delete(injection);
            injection.active?.();
            injection.active = undefined;
          };
          disposers.push(dispose);
          sync(injection); // Setup errors must propagate synchronously.
          return dispose;
        },
      },
    };
    return {
      ctx, dictionaries, listeners,
      dispose() { for (const dispose of disposers.splice(0).reverse()) dispose(); },
    };
  }
  return {
    declare, collapse, context, declarations,
    entries: (key) => cells.get(key) ?? [],
    winners(key) {
      const seen = new Set();
      return [...(cells.get(key) ?? [])]
        .sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))
        .filter((entry) => {
          if (seen.has(entry.options.id)) return false;
          seen.add(entry.options.id);
          return true;
        });
    },
  };
}

function registerNative(ctx) {
  ctx.slots.inject(TAIL, () => ctx.slots.register({
    name: TAIL,
    id: NATIVE_ID,
    children: { [ACTIONS]: { kind: 'list', scope: 'session' } },
  }, function NativeTail() {}));
}

for (const delayedDeclaration of [false, true]) {
  for (const filterFirst of [false, true]) {
    const label = `declaration ${delayedDeclaration ? 'after' : 'before'} apply; ${filterFirst ? 'filter' : 'native'} first`;
    test(`actual client apply coexists and unload restores native: ${label}`, () => {
      const slots = createSlots();
      const native = slots.context('native');
      const filter = slots.context('filter');
      const { plugin, requests } = loadClient();
      if (!delayedDeclaration) slots.declare(TAIL);
      if (filterFirst) {
        plugin.apply(filter.ctx);
        registerNative(native.ctx);
      } else {
        registerNative(native.ctx);
        plugin.apply(filter.ctx);
      }
      if (delayedDeclaration) slots.declare(TAIL);
      assert.equal(slots.entries(TAIL).length, 2, 'native must stay registered');
      const [winner] = slots.winners(TAIL);
      assert.equal(winner.owner, 'filter');
      assert.equal(winner.options.id, NATIVE_ID);
      assert.equal(winner.options.priority, -1);
      assert.ok(slots.declarations.has(ACTIONS), 'native actions must remain declared');
      assert.equal(filter.dictionaries.size, 2);
      assert.equal(requests[0][0], '/dsh-changes-filter/rules.json');
      const injected = winner.options.inject('session-test');
      assert.equal(typeof injected.hooks.changesSummary.getSnapshot, 'function');
      assert.equal(typeof injected.openChangesReview, 'function');
      assert.equal(typeof injected.loadChangesSummary, 'function');
      filter.dispose();
      filter.dispose();
      assert.equal(slots.entries(TAIL).length, 1);
      assert.equal(slots.winners(TAIL)[0].owner, 'native');
      assert.ok(slots.declarations.has(ACTIONS));
      assert.equal(filter.dictionaries.size, 0);
      assert.equal(filter.listeners.size, 0);
      native.dispose();
      assert.equal(slots.entries(TAIL).length, 0);
    });

    test(`regression control rejects old priority-0 collision: ${label}`, () => {
      assert.ok(source.includes('priority: -1,'), 'mutation must remove the real priority');
      const { plugin } = loadClient(source.replace('priority: -1,', ''));
      const slots = createSlots();
      const native = slots.context('native');
      const filter = slots.context('filter');
      if (!delayedDeclaration) slots.declare(TAIL);
      assert.throws(() => {
        if (filterFirst) {
          plugin.apply(filter.ctx);
          registerNative(native.ctx);
        } else {
          registerNative(native.ctx);
          plugin.apply(filter.ctx);
        }
        if (delayedDeclaration) slots.declare(TAIL);
      }, /already has an entry.*priority 0/);
      filter.dispose();
      native.dispose();
    });
  }
}

test('declaration collapse/recreation rebinds once; unloading pending filter cancels it', () => {
  const slots = createSlots();
  const native = slots.context('native');
  const filter = slots.context('filter');
  const { plugin } = loadClient();
  registerNative(native.ctx);
  plugin.apply(filter.ctx);
  slots.declare(TAIL);
  slots.collapse(TAIL);
  assert.equal(slots.entries(TAIL).length, 0);
  slots.declare(TAIL);
  assert.equal(slots.entries(TAIL).length, 2);
  assert.equal(slots.winners(TAIL)[0].owner, 'filter');
  slots.collapse(TAIL);
  filter.dispose();
  slots.declare(TAIL);
  assert.equal(slots.entries(TAIL).length, 1);
  assert.equal(slots.winners(TAIL)[0].owner, 'native');
  native.dispose();
});
