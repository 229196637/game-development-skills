import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { clientSource } from '../scripts/client-source.mjs';

const source = await clientSource();
const Fragment = Symbol('fragment');

// Minimal React: enough to render the production workbench tree without a DOM.
const React = {
  createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  Fragment,
  useState(initial) { return [initial, () => {}]; },
  useEffect() {},
  useRef() { return { current: null }; },
};

function render(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) { for (const child of node) render(child, out); return out; }
  if (typeof node !== 'object') return out;
  if (node.type === Fragment) { for (const child of node.children) render(child, out); return out; }
  if (typeof node.type === 'function') {
    render(node.type({ ...node.props, children: node.children }), out);
    return out;
  }
  out.push(node);
  for (const child of node.children) render(child, out);
  return out;
}

const tasks = [
  { id: 'A', class: 'base', status: 'completed', depends_on: [], blocked_by: [], items: [['x', 'one']], claim: '', file: 'A.md' },
  { id: 'B', class: 'middle', status: 'todo', depends_on: ['A'], blocked_by: [], items: [[' ', 'one'], ['x', 'two']], claim: '', file: 'B.md' },
  { id: 'C', class: 'last', status: 'blocked', depends_on: ['B'], blocked_by: ['B'], items: [[' ', 'one']], claim: '', file: 'C.md' },
  { id: 'Z', class: 'loose', status: 'todo', depends_on: [], blocked_by: [], items: [], claim: '', file: 'Z.md' },
];
const snapshot = {
  root: 'R', readme: 'R/README.md', updated: '2026-11-07', counts: { todo: 2, doing: 0, blocked: 1, completed: 1, total: 4 },
  progress: { percent: 25, itemsChecked: 2, itemsTotal: 5 }, ready: ['B', 'Z'], next: 'B', tasks,
  consistency: { stable: true }, readAt: '2026-11-07T00:00:00+08:00',
};

async function harness(override) {
  const registered = [];
  let installed;
  const context = {
    providers: {},
    window: { __ModuleLoader__: { load(module) {
      installed = module.factory(() => React).apply({
        locale: { register() { return () => {}; }, bind() { return key => key; } },
        effect(effect) { effect(); },
        on() {},
        slots: { inject(slot, callback) { callback(); }, register(options, component) { registered.push({ options, component }); return () => {}; } },
        get(key) { return this.providers[key]; },
        remote: { async $mount() {}, commands: { execute() { throw new Error('read-only'); } } },
      });
    } } },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { visibilityState: 'visible' }, setInterval, clearInterval,
  };
  vm.runInNewContext(source.replace('        function button(', '        globalThis.gwoTest = { storeFor, select, discover, readDocument, closeDocument, adoptSnapshot };\n        function button('), context);
  await installed;
  const view = registered.find(entry => entry.options.name === 'conversation.view');
  assert.ok(view, 'the workbench must register conversation.view');
  const store = context.gwoTest.storeFor('s');
  context.gwoTest.adoptSnapshot(store, JSON.parse(JSON.stringify(override || snapshot)));
  return { store, view: () => view.component({ sessionId: 's' }) };
}

const className = element => String(element.props.className || '');
const hasClass = (element, name) => className(element).split(/\s+/).includes(name);
const nodes = tree => tree.filter(element => hasClass(element, 'gwo-node'));
// The SVG container is `gwo-edges`; only real links carry `gwo-edge` or `gwo-edge-*`.
const edges = tree => tree.filter(element => className(element).split(/\s+/).some(token => token === 'gwo-edge' || token.startsWith('gwo-edge-')));

test('the workbench draws one card per ticket and one arrow per dependency', async () => {
  const app = await harness();
  const tree = render(app.view());
  const cards = nodes(tree);
  assert.equal(cards.length, 4);
  assert.equal(edges(tree).length, 2, 'A->B and B->C; Z has no dependency');
  for (const card of cards) assert.ok(['todo', 'doing', 'blocked', 'completed'].includes(card.props['data-state']));
  const next = cards.filter(card => card.props['data-next'] !== undefined);
  assert.equal(next.length, 1);
  assert.ok(next[0].props.title.startsWith('middle'));
  assert.ok(edges(tree).every(edge => String(edge.props['marker-end']).includes('arrow')));
});

test('choosing a node selects it, clears a hiding filter, and highlights its chain', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, filter: 'completed', ticketId: 'A' };
  let tree = render(app.view());
  const cards = nodes(tree);
  assert.equal(cards.length, 4, 'the map is built from the whole snapshot, not the filtered list');
  cards.find(card => card.props.title.startsWith('middle')).props.onClick();
  assert.equal(app.store.viewState.ticketId, 'B');
  assert.equal(app.store.viewState.filter, '', 'a hidden ticket must become visible when chosen from the map');
  app.store.viewState = { ...app.store.viewState, filter: '' };
  tree = render(app.view());
  const selected = nodes(tree).find(card => card.props['data-selected'] !== undefined);
  assert.ok(selected.props.title.startsWith('middle'));
  assert.equal(nodes(tree).filter(card => card.props['data-dim'] !== undefined).length, 1, 'only the unrelated ticket is dimmed');
});

test('a collapsed map keeps its summary and draws no cards', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, graphs: { R: { open: false } } };
  const tree = render(app.view());
  assert.equal(nodes(tree).length, 0);
  assert.ok(tree.some(element => hasClass(element, 'gwo-map-closed')));
});

test('an empty snapshot shows guidance instead of an empty canvas', async () => {
  const app = await harness();
  app.store.snapshot = { ...snapshot, tasks: [], ready: [], next: undefined, counts: { todo: 0, doing: 0, blocked: 0, completed: 0, total: 0 }, progress: { percent: 0, itemsChecked: 0, itemsTotal: 0 } };
  const tree = render(app.view());
  assert.equal(nodes(tree).length, 0);
  assert.ok(tree.some(element => hasClass(element, 'gwo-map-hint') && hasClass(element, 'gwo-muted')));
});

const bigSnapshot = (() => {
  const tasks = Array.from({ length: 600 }, (_, index) => ({
    id: `T${index}`, class: `c${index}`, status: 'todo', depends_on: index ? [`T${index - 1}`] : [],
    blocked_by: [], items: [[' ', 'one']], claim: '', file: `T${index}.md`,
  }));
  return { ...snapshot, tasks, ready: ['T0'], next: 'T0', counts: { todo: 600, doing: 0, blocked: 0, completed: 0, total: 600 }, progress: { percent: 0, itemsChecked: 0, itemsTotal: 600 } };
})();

test('a reopened map restores its saved pan and zoom', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, graphs: { R: { open: true, view: { zoom: 2, pan: { x: 10, y: 20 } } } } };
  const tree = render(app.view());
  const plane = tree.find(element => hasClass(element, 'gwo-plane'));
  assert.ok(plane, 'the plane must render when the map is open');
  assert.match(String(plane.props.style.transform), /translate\(10px, 20px\) scale\(2\)/);
});

test('the canvas is keyboard reachable with a single roving tab stop', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, filter: '', ticketId: 'B' };
  const tree = render(app.view());
  const viewport = tree.find(element => hasClass(element, 'gwo-viewport'));
  assert.equal(viewport.props.tabIndex, 0);
  assert.equal(viewport.props.role, 'group');
  const cards = nodes(tree);
  const stops = cards.filter(card => card.props.tabIndex === 0);
  assert.equal(stops.length, 1, 'only the selected card is in the tab order');
  assert.ok(stops[0].props.title.startsWith('middle'));
  for (const card of cards) {
    assert.equal(card.props.role, undefined, 'the card itself is the button');
    assert.ok(String(card.props['aria-label']).includes('·'));
  }
  const selectedLabel = cards.find(card => card.props['data-selected'] !== undefined).props['aria-label'];
  assert.ok(selectedLabel.includes('base') || selectedLabel.includes('depends'), selectedLabel);
});

test('an oversized snapshot draws a bounded neighbourhood and admits it', async () => {
  const app = await harness(bigSnapshot);
  const tree = render(app.view());
  const cards = nodes(tree);
  assert.ok(cards.length <= 500, `expected at most 500 cards, drew ${cards.length}`);
  assert.ok(cards.length > 1);
  const texts = tree.flatMap(element => element.children.filter(child => typeof child === 'string'));
  assert.ok(texts.some(text => text.includes('graphLarge')), 'the focused-subset notice must be shown');
  assert.ok(tree.some(element => element.children.includes('graphFull')), 'and a way back to the whole map');
});

function pointer(overrides) {
  const calls = { prevented: 0 };
  return {
    calls,
    event: {
      button: 0, clientX: 100, clientY: 100, pointerId: 7,
      target: { closest: () => null },
      preventDefault() { calls.prevented += 1; },
      ...overrides,
    },
  };
}

test('the right button pans the canvas anywhere and suppresses the context menu', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, graphs: { R: { open: true } } };
  const tree = render(app.view());
  const viewport = tree.find(element => hasClass(element, 'gwo-viewport'));
  const card = nodes(tree)[0];
  const down = pointer({ button: 2, target: { closest: () => card } });
  viewport.props.onPointerDown(down.event);
  viewport.props.onPointerMove({ clientX: 140, clientY: 130 });
  viewport.props.onPointerUp();
  assert.equal(app.store.viewState.graphs.R.view.pan.x, 64);
  assert.equal(app.store.viewState.graphs.R.view.pan.y, 54, 'right-drag must move the plane even over a card');
  const menu = pointer({});
  assert.equal(viewport.props.onContextMenu(menu.event), false);
  assert.equal(menu.calls.prevented, 1);
});

test('the middle button never pans and a left press on a card is left to selection', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, graphs: { R: { open: true } } };
  const tree = render(app.view());
  const viewport = tree.find(element => hasClass(element, 'gwo-viewport'));
  const card = nodes(tree)[0];
  const middle = pointer({ button: 1 });
  viewport.props.onPointerDown(middle.event);
  viewport.props.onPointerMove({ clientX: 200, clientY: 200 });
  assert.equal(app.store.viewState.graphs.R.view, undefined, 'middle button must not pan');
  assert.equal(middle.calls.prevented, 1, 'middle auto-scroll is suppressed');
  const leftOnCard = pointer({ button: 0, target: { closest: () => card } });
  viewport.props.onPointerDown(leftOnCard.event);
  viewport.props.onPointerMove({ clientX: 260, clientY: 240 });
  assert.equal(app.store.viewState.graphs.R.view, undefined, 'a left press on a card only selects');
});

test('dragging empty canvas with the left button still pans', async () => {
  const app = await harness();
  app.store.viewState = { ...app.store.viewState, graphs: { R: { open: true } } };
  const tree = render(app.view());
  const viewport = tree.find(element => hasClass(element, 'gwo-viewport'));
  viewport.props.onPointerDown(pointer({ button: 0 }).event);
  viewport.props.onPointerMove({ clientX: 124, clientY: 104 });
  viewport.props.onPointerUp();
  assert.equal(app.store.viewState.graphs.R.view.pan.x, 48);
  assert.equal(app.store.viewState.graphs.R.view.pan.y, 28);
});

test('an in-flight ticket makes only its incoming arrow flow', async () => {
  const doing = { ...snapshot, tasks: snapshot.tasks.map(item => item.id === 'B' ? { ...item, status: 'doing' } : item) };
  const app = await harness(doing);
  const tree = render(app.view());
  const links = edges(tree);
  assert.equal(links.length, 2);
  const flowing = links.filter(link => link.props['data-flow'] === 'active');
  assert.equal(flowing.length, 1, 'only A->B ends on the in-flight ticket');
  assert.ok(String(flowing[0].props['marker-end']).includes('arrow-active'));
  assert.equal(links.filter(link => link.props['data-flow'] === undefined).length, 1);
});

test('ready tickets are marked as claimable in parallel, and motion can be switched off', async () => {
  const app = await harness();
  const tree = render(app.view());
  const parallel = nodes(tree).filter(card => card.props['data-parallel'] !== undefined);
  assert.equal(parallel.length, 1, 'Z is ready while B is already the suggested next one');
  assert.ok(parallel[0].props.title.startsWith('loose'));
  const section = tree.find(element => hasClass(element, 'gwo-map'));
  assert.equal(section.props['data-motion'], 'on');
  const toggle = tree.find(element => Array.isArray(element.children) && element.children.includes('motionOff'));
  assert.ok(toggle, 'the map must offer a motion toggle');
  toggle.props.onClick();
  assert.equal(app.store.viewState.graphs.R.motion, false);
  assert.equal(toggle.props['aria-pressed'], true);
});