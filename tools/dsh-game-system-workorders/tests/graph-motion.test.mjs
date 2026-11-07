import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { progressedTargets } from '../src/client/graph-view.js';

const css = await readFile(new URL('../src/client/workbench.css', import.meta.url), 'utf8');

test('only tickets that just started or finished trigger a burst', () => {
  const previous = new Map([['A', 'todo'], ['B', 'todo'], ['C', 'doing'], ['D', 'blocked'], ['E', 'completed']]);
  const next = new Map([['A', 'doing'], ['B', 'blocked'], ['C', 'doing'], ['D', 'completed'], ['E', 'todo']]);
  const moved = progressedTargets(previous, next);
  assert.deepEqual([...moved].sort(), ['A', 'D']);
  assert.equal(progressedTargets(null, next).size, 0, 'the first snapshot has no baseline');
  assert.equal(progressedTargets(previous, new Map([['F', 'doing']])).size, 0, 'a new ticket is not a progress event');
});

test('flow decoration is scoped, colour-tokened and respects reduced motion', () => {
  assert.match(css, /\.gwo-edge\[data-flow=active\]\s*\{[^}]*stroke:\s*var\(--dsw-alias-brand-primary\)/);
  assert.match(css, /\.gwo-edge\[data-flow=recent\]\s*\{[^}]*stroke:\s*var\(--dsw-alias-state-success-primary\)/);
  assert.match(css, /\.gwo-map\[data-motion=on\]\s+\.gwo-edge\[data-flow=active\]\s*\{[^}]*animation:\s*gwo-flow/);
  assert.match(css, /@keyframes\s+gwo-flow\s*\{[^}]*stroke-dashoffset:\s*-16/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.gwo-edge\s*\{[^}]*animation:\s*none\s*!important/);
  assert.match(css, /\.gwo-node\[data-parallel\]\s*\{[^}]*var\(--dsw-alias-brand-primary\)/);
});

test('no animation escapes the plugin surface', () => {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for (const [, selector, body] of blocks) {
    if (!/animation\s*:/.test(body) || selector.includes('@keyframes') || /^\s*(to|from|\d+%)\s*$/.test(selector)) continue;
    for (const part of selector.split(',')) {
      const trimmed = part.trim();
      assert.ok(trimmed.startsWith('.gwo') || trimmed.startsWith('@media'), `animation must stay inside .gwo: ${trimmed}`);
    }
  }
});
