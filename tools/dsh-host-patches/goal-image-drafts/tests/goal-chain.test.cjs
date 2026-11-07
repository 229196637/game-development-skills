const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const { fixtureRoot } = require('../fixtures.cjs');
const base = path.join(fixtureRoot, 'original/node_modules/@deepseek-ai');
const raw = fs.readFileSync(path.join(base, 'dsh-goal-round-driver/lib/index.js'), 'utf8');
const source = raw.replace(/^import .*;\r?\n/gm, '').replace(/^export .*;\s*$/m, '') + '\nthis.driver = { apply };';
function harness(options = {}) {
  const listeners = new Map(); const queued = []; const warnings = []; let seq = 0;
  let goal = { id: 'goal-1', revision: 3, objective: 'finish fixture', maxGoalRounds: 10, roundsStarted: 1, phase: 'active', activation: 'disarmed', ...options.goal };
  const agent = { id: 'session-fixture', session: { id: 'session-fixture' }, status: options.status || 'idle', inbox: { nextTurn: [], nextStep: [], remove() {}, prepend() {} }, followup(message) { queued.push(message); this.status = 'running'; }, cancel() {}, whenIdle: async () => {} };
  const emit = (name, ...args) => { for (const fn of listeners.get(name) || []) fn(...args); };
  const ctx = { fiber: { state: 2 }, logger: { warn: text => warnings.push(text) }, agents: { get: id => id === agent.id ? agent : undefined, list: () => [], withoutInitiator: fn => fn(), currentInitiator: () => undefined }, goals: { get: () => goal, disarm: () => { goal.activation = 'disarmed'; }, pause: () => { goal.phase = 'paused'; goal.activation = 'disarmed'; }, block: (_agent, _ref, reason) => { goal.phase = 'blocked'; goal.activation = 'disarmed'; goal.blockedReason = reason; } }, sessions: { flush: options.flush || (async () => {}) }, get: () => undefined, on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); }, effect: fn => { const g = fn(); g.next(); } };
  const box = { Promise, isDeepStrictEqual, createUserMessage: data => ({ id: `message-${++seq}`, ...data }) };
  vm.runInNewContext(source, box); box.driver.apply(ctx);
  return { ctx, agent, queued, warnings, emit, get goal() { return goal; }, resume() { goal = { ...goal, revision: goal.revision + 1, phase: 'active', activation: 'armed' }; emit('goal/changed', { agent, change: { operation: 'resume' } }); } };
}
const settle = async () => { for (let i = 0; i < 12; ++i) await Promise.resolve(); };
for (const phase of ['paused', 'active', 'blocked']) test(`existing driver: resume ${phase} immediately queues one same-session goal round`, async () => {
  const h = harness({ goal: { phase } }); h.resume(); await settle(); assert.equal(h.queued.length, 1); assert.equal(h.queued[0].source.kind, 'goal'); assert.equal(h.queued[0].source.round, 2); assert.equal(h.queued[0].source.revision, h.goal.revision); assert.equal(h.warnings.length, 0);
});
test('existing driver: no explicit session prompt is needed and duplicate trigger does not double-send', async () => { const h = harness(); h.resume(); h.emit('goal/changed', { agent: h.agent, change: { operation: 'resume' } }); await settle(); assert.equal(h.queued.length, 1); });
test('existing driver: running session continues at next idle, not a competing prompt', async () => { const h = harness({ status: 'running' }); h.resume(); await settle(); assert.equal(h.queued.length, 0); h.agent.status = 'idle'; h.emit('agent/status', { agent: h.agent, status: 'idle' }); await settle(); assert.equal(h.queued.length, 1); });
test('existing driver: checkpoint failure fails closed without starting a round', async () => { const h = harness({ flush: async () => { throw new Error('fixture disk failure'); } }); h.resume(); await settle(); assert.equal(h.queued.length, 0); assert.equal(h.goal.activation, 'disarmed'); assert.match(h.warnings[0], /durability checkpoint failed/); });
test('existing driver: exhausted cap blocks rather than starts an extra round', async () => { const h = harness({ goal: { roundsStarted: 10 } }); h.resume(); await settle(); assert.equal(h.queued.length, 0); assert.equal(h.goal.blockedReason.code, 'round-limit'); });
test('UI proven defect: blocked goal has no resume button although service and command support it', () => { const ui = fs.readFileSync(path.join(base, 'dsh-client-ui-goal/lib/client.js'), 'utf8'); const body = ui.match(/const showResume = ([^;]+);/)[1]; const visible = new Function('goal', 'activation', `return ${body}`); assert.equal(visible({phase:'paused'}, 'disarmed'), true); assert.equal(visible({phase:'blocked'}, 'disarmed'), false); });
