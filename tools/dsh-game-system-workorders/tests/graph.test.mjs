import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, countGraph, focusSet, linkedIds, edgePath, relatedTasks, NODE_W, NODE_H, MAX_NODES } from '../src/client/graph.js';

const task = (id, depends, extra = {}) => ({ id, class: `class-${id}`, status: 'todo', depends_on: depends || [], items: [[' ', 'one']], claim: '', ...extra });

test('a chain is layered top-down and arrows point from prerequisite to dependent', () => {
  const graph = buildGraph([task('C', ['B']), task('A'), task('B', ['A'])]);
  const at = id => graph.nodes.find(node => node.id === id);
  assert.equal(at('A').layer, 0);
  assert.equal(at('B').layer, 1);
  assert.equal(at('C').layer, 2);
  assert.deepEqual(graph.edges, [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]);
  const path = edgePath(at('A'), at('B'));
  assert.ok(path.startsWith(`M${at('A').x + NODE_W / 2},${at('A').y + NODE_H}`), path);
  assert.ok(path.endsWith(`${at('B').x + NODE_W / 2},${at('B').y}`), path);
});

test('a diamond fans out and merges without inventing or dropping edges', () => {
  const graph = buildGraph([task('A'), task('B', ['A']), task('C', ['A']), task('D', ['B', 'C'])]);
  const at = id => graph.nodes.find(node => node.id === id);
  assert.equal(at('D').layer, 2);
  assert.equal(graph.edges.length, 4);
  assert.deepEqual(at('D').depends.sort(), ['B', 'C']);
  assert.deepEqual(at('A').dependents.sort(), ['B', 'C']);
  assert.deepEqual(graph.layers, [1, 2, 1]);
});

test('roots stay on the first row and isolated tickets keep their place without edges', () => {
  const graph = buildGraph([task('A'), task('B'), task('C', ['A'])]);
  assert.equal(graph.nodes.filter(node => node.layer === 0).length, 2);
  assert.equal(graph.nodes.find(node => node.id === 'B').dependents.length, 0);
  assert.equal(graph.isolated, false);
  assert.equal(buildGraph([task('A')]).isolated, true);
  assert.equal(buildGraph([task('A')]).width, NODE_W);
});

test('ready, next and checklist progress come from the snapshot', () => {
  const graph = buildGraph([
    task('A', [], { items: [['x', 'done'], ['x', 'also'], [' ', 'left']] }),
    task('B', ['A'], { status: 'blocked' }),
  ], { ready: ['A'], next: 'A' });
  const at = id => graph.nodes.find(node => node.id === id);
  assert.deepEqual(at('A').items, { done: 2, total: 3 });
  assert.equal(at('A').ready, true);
  assert.equal(at('A').next, true);
  assert.equal(at('B').ready, false);
  assert.equal(at('B').status, 'blocked');
  assert.equal(at('B').items.done, 0);
});

test('duplicate ids are reported once and never drawn twice', () => {
  const graph = buildGraph([task('A'), task('A', ['A'])]);
  assert.equal(graph.nodes.length, 1);
  assert.deepEqual(graph.issues.filter(issue => issue.kind === 'duplicate').map(issue => issue.id), ['A']);
});

test('a prerequisite outside the snapshot is reported and adds no edge', () => {
  const graph = buildGraph([task('A', ['missing'])]);
  assert.equal(graph.edges.length, 0);
  assert.deepEqual(graph.issues, [{ kind: 'missing', id: 'A', dependency: 'missing' }]);
  assert.equal(graph.nodes[0].layer, 0);
});

test('a dependency cycle is isolated below the graph instead of hanging the layout', () => {
  const graph = buildGraph([task('A', ['B']), task('B', ['A']), task('C')]);
  const cycle = graph.issues.find(issue => issue.kind === 'cycle');
  assert.deepEqual([...cycle.ids].sort(), ['A', 'B']);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.nodes.find(node => node.id === 'C').layer, 0);
  assert.equal(graph.nodes.find(node => node.id === 'A').layer, 1);
});

test('a snapshot made only of a cycle still renders on one row', () => {
  const graph = buildGraph([task('A', ['B']), task('B', ['A'])]);
  assert.equal(graph.layers.length, 1);
  assert.equal(graph.nodes.length, 2);
  assert.ok(graph.issues.some(issue => issue.kind === 'cycle'));
  assert.ok(graph.height > 0 && graph.width >= NODE_W * 2);
});

test('layout is deterministic for the same snapshot', () => {
  const tasks = [task('A'), task('B', ['A']), task('C', ['A']), task('D', ['B', 'C']), task('E')];
  assert.deepEqual(buildGraph(tasks), buildGraph(tasks));
  assert.equal(buildGraph(tasks).nodes.length, 5);
});

test('large snapshots are flagged so the caller can draw a local map', () => {
  const graph = buildGraph([task('A'), task('B'), task('C')], { maxNodes: 2 });
  assert.equal(graph.large, true);
  assert.equal(graph.limits.nodes, 2);
  assert.equal(buildGraph([task('A')], { maxNodes: 2 }).large, false);
});

test('drawn cards never overlap and stay inside the reported canvas', () => {
  const tasks = [task('root')];
  for (let i = 0; i < 6; i++) {
    tasks.push(task(`mid${i}`, ['root']));
    tasks.push(task(`leaf${i}a`, [`mid${i}`]));
    tasks.push(task(`leaf${i}b`, [`mid${i}`]));
  }
  tasks.push(task('lonely'));
  const graph = buildGraph(tasks);
  assert.equal(graph.nodes.length, tasks.length);
  assert.equal(graph.edges.length, 6 + 12);
  assert.deepEqual(graph.layers, [2, 6, 12]);

  for (const node of graph.nodes) {
    assert.ok(node.x >= 0 && node.y >= 0, `${node.id} starts inside the canvas`);
    assert.ok(node.x + NODE_W <= graph.width, `${node.id} fits the canvas width`);
    assert.ok(node.y + NODE_H <= graph.height, `${node.id} fits the canvas height`);
    assert.ok(Number.isInteger(node.x) || Number.isFinite(node.x));
  }
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];
      const overlapX = Math.abs(a.x - b.x) < NODE_W;
      const overlapY = Math.abs(a.y - b.y) < NODE_H;
      assert.ok(!(overlapX && overlapY), `${a.id} and ${b.id} must not overlap`);
    }
  }
  for (const edge of graph.edges) {
    const from = graph.nodes.find(node => node.id === edge.from);
    const to = graph.nodes.find(node => node.id === edge.to);
    assert.ok(from.layer < to.layer, `${edge.from} sits above ${edge.to}`);
  }
});

test('linked ids cover both directions and related tasks stay local', () => {
  const graph = buildGraph([task('A'), task('B', ['A']), task('C', ['B']), task('Z')]);
  assert.deepEqual([...linkedIds(graph, 'B')].sort(), ['A', 'B', 'C']);
  assert.deepEqual([...relatedTasks([task('A'), task('B', ['A']), task('C', ['B']), task('Z')], 'B')].sort(), ['A', 'B', 'C']);
  assert.equal(linkedIds(graph, '').size, 0);
  assert.equal(linkedIds(buildGraph([task('Z')]), 'Z').size, 1);
});

test('counting a snapshot is cheap and never lays anything out', () => {
  const counts = countGraph([task('A'), task('B', ['A']), task('C', ['A', 'B']), task('Z', ['missing']), task('B', ['A'])]);
  assert.deepEqual(counts, { ids: 4, edges: 3, duplicate: 1, missing: 1 });
});

test('a drawn subset never invents a missing prerequisite from the whole snapshot', () => {
  const all = [task('X'), task('Z', ['X']), task('A', ['Z']), task('B', ['A'])];
  const subset = all.filter(item => item.id !== 'X');
  const graph = buildGraph(subset, { include: new Set(['Z', 'A', 'B']), known: new Set(all.map(item => item.id)), focus: 'A' });
  assert.equal(graph.issues.filter(issue => issue.kind === 'missing').length, 0);
  assert.deepEqual(graph.edges.map(edge => `${edge.from}>${edge.to}`), ['Z>A', 'A>B']);
  assert.equal(graph.nodes.find(node => node.id === 'Z').layer, 0, 'Z stays a root even though its own prerequisite is outside the drawing');
  const blind = buildGraph(subset, { include: new Set(['Z', 'A', 'B']) });
  assert.ok(blind.issues.some(issue => issue.kind === 'missing' && issue.id === 'Z' && issue.dependency === 'X'), 'without `known` the subset still reports the real gap');
});

test('an oversized snapshot keeps the focused neighbourhood and reports the truncation', () => {
  const tasks = Array.from({ length: 600 }, (_, index) => task(`T${index}`, index ? [`T${index - 1}`] : []));
  const graph = buildGraph(tasks, { focus: 'T400', maxNodes: MAX_NODES });
  assert.equal(graph.nodes.length, MAX_NODES);
  assert.ok(graph.truncated.nodes >= 100);
  assert.equal(graph.large, true);
  assert.ok(graph.nodes.some(node => node.id === 'T400'), 'the focused ticket must survive truncation');
  assert.ok(graph.nodes.some(node => node.id === 'T399') && graph.nodes.some(node => node.id === 'T401'));
  assert.equal(graph.counts.candidates, 600);
});

test('only real cycle members are marked; their descendants are merely unreachable', () => {
  const graph = buildGraph([task('A', ['B']), task('B', ['A']), task('D', ['B']), task('R')]);
  const cycle = graph.issues.find(issue => issue.kind === 'cycle');
  assert.deepEqual([...cycle.ids].sort(), ['A', 'B'], 'D depends on the cycle but is not part of it');
  const unreachable = graph.issues.find(issue => issue.kind === 'unreachable');
  assert.deepEqual([...unreachable.ids], ['D']);
  assert.equal(graph.edges.filter(edge => ['A', 'B'].includes(edge.from) && ['A', 'B'].includes(edge.to)).length, 0, 'cycle edges are not drawn backwards');
  assert.notEqual(graph.nodes.find(node => node.id === 'A').layer, graph.nodes.find(node => node.id === 'D').layer);
});

test('a self dependency is a one-ticket cycle and never becomes an edge', () => {
  const graph = buildGraph([task('S', ['S']), task('T')]);
  assert.equal(graph.edges.length, 0);
  assert.deepEqual(graph.issues.find(issue => issue.kind === 'cycle').ids, ['S']);
  assert.equal(graph.skippedEdges, 1);
});

test('a ticket whose only prerequisite is unknown is not reported as isolated', () => {
  const graph = buildGraph([task('A', ['gone'])]);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.isolated, false);
  assert.ok(graph.issues.some(issue => issue.kind === 'missing' && issue.id === 'A' && issue.dependency === 'gone'));
  assert.equal(buildGraph([task('A'), task('B')]).isolated, true);
});

test('the focused closure walks both directions and stays under its cap', () => {
  const tasks = [task('A'), task('B', ['A']), task('C', ['B']), task('D')];
  assert.deepEqual([...focusSet(tasks, 'B')].sort(), ['A', 'B', 'C']);
  const chain = Array.from({ length: 40 }, (_, index) => task(`N${index}`, index ? [`N${index - 1}`] : []));
  const capped = focusSet(chain, 'N20', 5);
  assert.equal(capped.size, 5);
  assert.ok(capped.has('N20'));
  assert.equal(focusSet([], 'anything').size, 0);
});

test('ready tickets are exposed as layers and as one parallel set', () => {
  const graph = buildGraph([
    task('A', [], { status: 'completed' }),
    task('B', ['A']), task('C', ['A']), task('D', ['B', 'C']), task('Z'),
  ], { ready: ['B', 'C', 'Z'], next: 'B' });
  assert.deepEqual(graph.waves.map(wave => wave.length), [2, 2, 1]);
  assert.deepEqual(graph.parallel.slice().sort(), ['B', 'C', 'Z']);
  assert.equal(graph.nodes.filter(node => node.ready && !node.next).length, 2);
  assert.equal(graph.layout, 'organic');
});

test('layered mode still lays every row on one line, organic staggers it', () => {
  const tasks = [task('A'), task('B'), task('C'), task('D', ['A']), task('E', ['B'])];
  const grid = buildGraph(tasks, { layout: 'layered' });
  const row = grid.nodes.filter(node => node.layer === 0).map(node => node.y);
  assert.equal(new Set(row).size, 1, 'layered keeps a single baseline per row');
  const organic = buildGraph(tasks);
  assert.ok(new Set(organic.nodes.filter(node => node.layer === 0).map(node => node.y)).size > 1, 'organic staggers rows');
  assert.equal(organic.nodes.filter(node => node.layer === 0).length, 3, 'staggering never reorders layers');
});

test('the arrow bows away from the straight vertical when the cards are offset', () => {
  const from = { id: 'A', x: 0, y: 0, layer: 0 };
  const to = { id: 'B', x: 400, y: 142, layer: 1 };
  const bowed = edgePath(from, to);
  assert.ok(bowed.startsWith(`M${NODE_W / 2},${NODE_H}`), bowed);
  assert.ok(bowed.endsWith(`${400 + NODE_W / 2},142`), bowed);
  const straight = edgePath(from, to, { bow: 0 });
  assert.ok(straight.includes(`C${NODE_W / 2},`), 'a zero bow puts both control points on the endpoints');
  assert.notEqual(bowed, straight);
  const reversed = edgePath({ ...from, id: 'B' }, { ...to, id: 'A' });
  assert.equal(reversed, edgePath({ ...from, id: 'B' }, { ...to, id: 'A' }), 'the same edge always bows the same way');
});

test('a multi-layer edge bows harder than a single-layer one', () => {
  const from = { id: 'A', x: 0, y: 0, layer: 0 };
  const near = edgePath(from, { id: 'B', x: 300, y: 142, layer: 1 });
  const far = edgePath(from, { id: 'B', x: 300, y: 426, layer: 3 });
  const controlX = path => Number(path.split('C')[1].split(',')[0]);
  assert.ok(Math.abs(controlX(far) - NODE_W / 2) > Math.abs(controlX(near) - NODE_W / 2));
});

test('vertically stacked cards stay on one straight line instead of an S-curve', () => {
  const from = { id: 'A', x: 0, y: 0, layer: 0 };
  for (const dx of [0, 2, -4]) {
    const path = edgePath(from, { id: 'B', x: dx, y: 142, layer: 1 });
    const [c1, c2] = path.split('C')[1].split(' ').map(point => Number(point.split(',')[0]));
    assert.equal(c1, NODE_W / 2, `control 1 stays on the source axis for dx=${dx}`);
    assert.equal(c2, NODE_W / 2 + dx, `control 2 stays on the target axis for dx=${dx}`);
  }
});

test('a leaning edge never bends back across itself', () => {
  const from = { id: 'A', x: 0, y: 0, layer: 0 };
  for (const dx of [40, 120, -120, 260]) {
    const path = edgePath(from, { id: 'B', x: dx, y: 142, layer: 1 });
    const [c1, c2] = path.split('C')[1].split(' ').map(point => Number(point.split(',')[0]));
    const low = Math.min(NODE_W / 2, NODE_W / 2 + dx);
    const high = Math.max(NODE_W / 2, NODE_W / 2 + dx);
    assert.ok(c1 >= low - 0.5 && c1 <= high + 0.5, `control 1 stays between the endpoints for dx=${dx}: ${c1}`);
    assert.ok(c2 >= low - 0.5 && c2 <= high + 0.5, `control 2 stays between the endpoints for dx=${dx}: ${c2}`);
  }
});
