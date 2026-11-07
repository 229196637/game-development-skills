import test from 'node:test';
import assert from 'node:assert/strict';
import { fitView, zoomAt, panBy, centerNode, nearestNeighbor, MIN_ZOOM, MAX_ZOOM, MIN_FIT, FIT_PAD } from '../src/client/graph-view.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test('fit keeps the whole graph inside the viewport with padding and never enlarges', () => {
  const fitted = fitView({ width: 1000, height: 400, viewportWidth: 1000, viewportHeight: 400 });
  close(fitted.zoom, 0.88);
  close(fitted.pan.x, (1000 - 1000 * 0.88) / 2);
  close(fitted.pan.y, (400 - 400 * 0.88) / 2);
  // A small graph is shown at 1:1 instead of being blown up to fill the frame.
  assert.equal(fitView({ width: 100, height: 64, viewportWidth: 1200, viewportHeight: 800 }).zoom, 1);
  // The padded box is what the graph has to fit into.
  const padded = fitView({ width: 952, height: 1, viewportWidth: 1000, viewportHeight: 400 });
  close(padded.zoom, 1);
  assert.ok(FIT_PAD === 24);
});

test('an extremely wide graph is still fitted, however small the factor', () => {
  const fitted = fitView({ width: 400000, height: 900, viewportWidth: 900, viewportHeight: 600 });
  assert.equal(fitted.zoom, MIN_FIT);
  assert.ok(fitted.pan.x < 0);
  assert.equal(fitView({ width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 }).zoom, 1);
});

test('zooming at a cursor keeps the world point under that cursor', () => {
  const view = { zoom: 1, pan: { x: 20, y: 30 } };
  const cursor = { x: 120, y: 80 };
  const worldBefore = { x: (cursor.x - view.pan.x) / view.zoom, y: (cursor.y - view.pan.y) / view.zoom };
  const zoomed = zoomAt(view, 2, cursor);
  const worldAfter = { x: (cursor.x - zoomed.pan.x) / zoomed.zoom, y: (cursor.y - zoomed.pan.y) / zoomed.zoom };
  close(zoomed.zoom, 2);
  close(worldAfter.x, worldBefore.x);
  close(worldAfter.y, worldBefore.y);
  assert.equal(zoomAt(view, 100, cursor).zoom, MAX_ZOOM);
  assert.equal(zoomAt(view, 0.0001, cursor).zoom, MIN_ZOOM);
});

test('panning is additive, keeps the zoom, and centring puts a node in the middle', () => {
  const view = { zoom: 1.5, pan: { x: 10, y: -20 } };
  const moved = panBy(view, 30, 40);
  assert.deepEqual(moved, { zoom: 1.5, pan: { x: 40, y: 20 } });
  assert.deepEqual(view.pan, { x: 10, y: -20 }, 'the input view must not be mutated');
  const centred = centerNode({ zoom: 2, pan: { x: 0, y: 0 } }, { id: 'A', x: 400, y: 200 }, { width: 1000, height: 600 }, 208, 64);
  close(centred.pan.x, 500 - (400 + 104) * 2);
  close(centred.pan.y, 300 - (200 + 32) * 2);
  assert.equal(centred.zoom, 2);
});

test('arrow navigation picks the nearest node in that direction only', () => {
  const nodes = [
    { id: 'A', x: 0, y: 0 }, { id: 'B', x: 300, y: 0 }, { id: 'C', x: 0, y: 200 },
    { id: 'D', x: 300, y: 200 }, { id: 'E', x: 150, y: 20 },
  ];
  assert.equal(nearestNeighbor(nodes, 'A', 'right'), 'E', 'the closest right node wins, not the first');
  assert.equal(nearestNeighbor(nodes, 'A', 'down'), 'C');
  assert.equal(nearestNeighbor(nodes, 'D', 'left'), 'C');
  assert.equal(nearestNeighbor(nodes, 'D', 'up'), 'B');
  assert.equal(nearestNeighbor(nodes, 'A', 'left'), null);
  assert.equal(nearestNeighbor(nodes, 'missing', 'right'), null);
});
