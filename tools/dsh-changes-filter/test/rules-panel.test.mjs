import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function fixture(response = { dirs: ['docs'], exts: ['.md'], noiseDirs: ['.agent-tmp'] }) {
  let client, states = [], cursor = 0;
  const requests = [];
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useEffect() {}, useSyncExternalStore(_, get) { return get(); },
  };
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(d) { client = d.factory(() => React); } } },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => options?.method === 'PUT' ? JSON.parse(options.body) : response };
    },
  });
  const tail = client.__internals.FilteredDeliverablesTail;
  const tailProps = {
    sessionId: 's', t: key => key,
    turn: { data: { get: () => ({ changes: { seq: 1 } }) } },
    useChangesSummary: () => ({ turn: 1, files: [{ path: '/work/.agent-tmp/a.js', display: '.agent-tmp/a.js' }] }),
  };
  const render = (component, props, initial) => {
    if (initial) states = initial;
    cursor = 0;
    return component(props);
  };
  return { client, requests, tail, tailProps, render };
}
function nodes(node) {
  return node && typeof node === 'object' ? [node, ...(node.props?.children ?? []).flatMap(nodes)] : [];
}

test('rules panel preserves process directories when clearing manual exclusions and saves explicit disabled list', async () => {
  const f = fixture();
  f.client.__internals.rulesStore.set({ status: 'ready', rules: { dirs: ['docs'], exts: ['.md'], noiseDirs: ['.agent-tmp'] } });
  const tail = f.render(f.tail, f.tailProps, [false, true]);
  const panel = nodes(tail).find(n => n.type?.name === 'RulesPanel');
  assert.ok(panel);
  let tree = f.render(panel.type, panel.props, []);
  assert.equal(nodes(tree).filter(n => n.type === 'textarea').length, 3);
  nodes(tree).find(n => n.props.key === 'clear').props.onClick();
  tree = f.render(panel.type, panel.props);
  let inputs = nodes(tree).filter(n => n.type === 'textarea');
  assert.deepEqual(inputs.map(n => n.props.value), ['', '', '.agent-tmp']);
  inputs[2].props.onChange({ target: { value: '' } });
  tree = f.render(panel.type, panel.props);
  await nodes(tree).find(n => n.props.key === 'save').props.onClick();
  const saved = f.requests.find(r => r.options?.method === 'PUT');
  assert.deepEqual(JSON.parse(saved.options.body), { dirs: [], exts: [], noiseDirs: [] });
});

test('unready or failed rules never expose an editable empty panel', () => {
  for (const status of ['loading', 'error']) {
    const f = fixture();
    f.client.__internals.rulesStore.set({ status, rules: { dirs: ['docs'], exts: [], noiseDirs: ['.agent-tmp'] } });
    const tree = f.render(f.tail, f.tailProps, [false, true]);
    assert.equal(nodes(tree).some(n => n.type?.name === 'RulesPanel'), false);
  }
});

test('legacy Host wire shape pauses editing instead of allowing silent noiseDirs loss', async () => {
  const f = fixture({ dirs: ['docs'], exts: ['.md'] });
  f.client.apply({
    effect() {}, on() {}, slots: { inject() {} },
  });
  await new Promise(resolve => setImmediate(resolve));
  const state = f.client.__internals.rulesStore.getSnapshot();
  assert.equal(state.status, 'error');
  assert.match(state.error, /host needs reload/);
  assert.deepEqual(JSON.parse(JSON.stringify(state.rules)), { dirs: [], exts: [], noiseDirs: [] });
});
