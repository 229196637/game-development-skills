const fs = require('node:fs'); const path = require('node:path'); const test = require('node:test'); const assert = require('node:assert/strict');
const { fixtureRoot } = require('../fixtures.cjs');
const relative = 'node_modules/@deepseek-ai/dsh-client-ui-goal/lib/client.js';
function fixture(kind) {
  const source = fs.readFileSync(path.join(fixtureRoot, kind, relative), 'utf8');
  const start = source.indexOf('const runAction = (0, react.useCallback)(async (action) => {');
  const end = source.indexOf('\n\t\t\t}, []);', start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start + 'const runAction = (0, react.useCallback)(async (action) => {'.length, end);
  const state = { pendingRef: { current: false }, pending: false, error: null };
  state.runAction = new Function('pendingRef', 'setPending', 'setActionError', `return async (action) => {${body}\n};`)(state.pendingRef, p => state.pending = p, e => state.error = e);
  state.showResume = new Function('goal', 'activation', `return ${source.match(/const showResume = ([^;]+);/)[1]};`);
  return state;
}
test('reproduce original: rejected RPC permanently locks all actions', async () => { const f = fixture('original'); await assert.rejects(f.runAction(async () => { throw new Error('network reset'); }), /network reset/); assert.equal(f.pendingRef.current, true); assert.equal(f.pending, true); let invoked = false; await f.runAction(async () => { invoked = true; return { ok: true }; }); assert.equal(invoked, false); });
test('patched: rejected RPC produces visible error, unlocks, and a retry works', async () => { const f = fixture('patched'); const result = await f.runAction(async () => { throw new Error('network reset'); }); assert.equal(result.ok, false); assert.equal(f.pendingRef.current, false); assert.equal(f.pending, false); assert.match(f.error, /network reset/); let invoked = false; await f.runAction(async () => { invoked = true; return { ok: true }; }); assert.equal(invoked, true); assert.equal(f.error, null); });
test('patched: structured domain rejection remains visible and does not lock', async () => { const f = fixture('patched'); await f.runAction(async () => ({ ok: false, error: { code: 'GOAL_STALE_REVISION', message: 'stale goal' } })); assert.match(f.error, /GOAL_STALE_REVISION/); assert.equal(f.pendingRef.current, false); });
test('patched: only one action runs while RPC remains outstanding', async () => { const f = fixture('patched'); const pending = Promise.withResolvers(); const first = f.runAction(() => pending.promise); let second = false; assert.equal(await f.runAction(async () => { second = true; return { ok: true }; }), undefined); assert.equal(second, false); pending.resolve({ ok: true }); await first; assert.equal(f.pendingRef.current, false); });
test('patched: paused, blocked, active-disarmed may resume, active-armed and complete may not', () => { const f = fixture('patched'); for (const phase of ['paused', 'blocked']) assert.equal(f.showResume({ phase }, 'disarmed'), true); assert.equal(f.showResume({ phase: 'active' }, 'disarmed'), true); assert.equal(f.showResume({ phase: 'active' }, 'armed'), false); assert.equal(f.showResume({ phase: 'complete' }, 'disarmed'), false); });
