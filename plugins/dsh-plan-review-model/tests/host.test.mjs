import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';
import { normalizeSelection, approvedAnswer, nativeSelectionOwner, planQuestion } from '../core.js';

const catalog = { groups: [{ id: 'provider/b', name: 'Provider', models: [{
  id: 'model/b', name: 'Model B', reasoning: { efforts: [{ id: 'high', name: 'High' }] }
}] }], failures: [], default: { provider: 'original', model: 'A' } };
const q = () => ({ id: 'plan-review', detail: '# Plan\n\nDo work', options: [{ label: 'Approve' }, { label: 'Keep planning' }], intent: { kind: 'plan-review', approve: 'Approve', callId: 'plan-1' } });
const answer = () => ({ answers: [{ id: 'plan-review', selected: ['Approve'] }] });

function fixture() {
  const listeners = new Map();
  const commits = [];
  const errors = [];
  let command;
  let failCommit = false;
  const controller = {
    modelCatalog: async () => catalog,
    agents: {
      selectionFor: agent => ({ current: agent.current }),
      selectForNextRequest: (agent, selection) => {
        if (failCommit) throw new Error('disk failure');
        agent.current = selection;
        commits.push({ agent, selection });
      },
      serializeImageAdmission: (_agent, op) => op()
    },
    selectModel: () => { throw new Error('must not write global default'); }
  };
  const ctx = {
    sessionController: controller,
    on: (name, listener) => { listeners.set(name, listener); return () => {}; },
    effect: fn => { fn(); },
    commands: { register: definition => { command = definition; return () => {}; } },
    logger: { error: (...args) => errors.push(args) }
  };
  apply(ctx);
  const agent = { session: {}, current: { provider: 'original', model: 'A', reasoningEffort: 'old' }, cancelled: null, cancel(reason) { this.cancelled = reason; } };
  const signal = new AbortController().signal;
  const begin = (target = agent, question = q()) => {
    const deferred = Promise.withResolvers();
    const result = listeners.get('user-questions/request')({ agent: target, questions: [question], signal }, () => deferred.promise);
    return { deferred, result };
  };
  const run = (input, target = agent) => command.handler({ agent: target, rawInput: JSON.stringify(input), signal });
  const final = (value = { approved: true }, isError = false, target = agent, callId = 'plan-1') => listeners.get('tools/result')({ name: 'exit_plan_mode', callId, agent: target, signal }, { value, isError });
  return { listeners, agent, signal, begin, run, final, commits, errors, controller, failCommit: () => { failCommit = true; } };
}

const choice = { provider: 'provider/b', model: 'model/b' };

test('normalizes exact provider/model IDs and removes unrelated controls', () => {
  assert.deepEqual(normalizeSelection({ ...choice, temperature: 1 }, catalog), choice);
  assert.deepEqual(normalizeSelection({ ...choice, reasoningEffort: 'high' }, catalog), { ...choice, reasoningEffort: 'high' });
  assert.equal(normalizeSelection(null, catalog), null);
  assert.throws(() => normalizeSelection({ ...choice, model: 'missing' }, catalog), /不可用/);
  assert.throws(() => normalizeSelection({ ...choice, reasoningEffort: 'old' }, catalog), /推理等级/);
});

test('approval predicate rejects feedback, duplicate answers, multiple selections', () => {
  assert.equal(approvedAnswer(q(), answer()), true);
  for (const answers of [
    [{ id: 'plan-review', selected: ['Approve'], custom: '' }],
    [{ id: 'plan-review', selected: ['Approve', 'Keep planning'] }],
    [...answer().answers, ...answer().answers],
    [{ id: 'other', selected: ['Approve'] }]
  ]) assert.equal(approvedAnswer(q(), { answers }), false);
  assert.equal(planQuestion([{ ...q(), intent: { kind: 'plan-review', approve: 'Approve' } }]), undefined);
  assert.throws(() => nativeSelectionOwner({}), /不支持/);
});

test('inspect and staging do not switch; only authoritative final success commits', async () => {
  const f = fixture();
  const r = f.begin();
  const inspected = await f.run({ action: 'inspect', callId: 'plan-1' });
  assert.equal(inspected.kind, 'success');
  assert.deepEqual(JSON.parse(inspected.text).current, f.agent.current);
  const staged = await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
  assert.equal(staged.kind, 'success');
  assert.equal(f.commits.length, 0);
  r.deferred.resolve(answer());
  assert.deepEqual(await r.result, answer());
  assert.equal(f.commits.length, 0);
  f.final();
  assert.deepEqual(f.agent.current, choice);
  assert.equal(f.commits.length, 1);
  f.final();
  assert.equal(f.commits.length, 1);
  assert.deepEqual(catalog.default, { provider: 'original', model: 'A' });
});

test('inherit works without loading catalog and leaves model/effort unchanged', async () => {
  const f = fixture(); const r = f.begin();
  f.controller.modelCatalog = async () => { throw new Error('provider unavailable'); };
  assert.equal((await f.run({ action: 'stage', callId: 'plan-1', selection: null })).kind, 'success');
  r.deferred.resolve(answer()); await r.result; f.final();
  assert.equal(f.commits.length, 0);
  assert.equal(f.agent.current.reasoningEffort, 'old');
});

test('cancel and feedback discard staged choice', async () => {
  for (const cancelled of [false, true]) {
    const f = fixture(); const r = f.begin();
    await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
    if (cancelled) { r.deferred.reject(new Error('ASK_CANCELLED')); await assert.rejects(r.result, /ASK_CANCELLED/); }
    else { r.deferred.resolve({ answers: [{ id: 'plan-review', selected: [], custom: 'change this' }] }); await r.result; }
    f.final(); assert.equal(f.commits.length, 0);
  }
});

test('no client command can approve; failed tool result cannot commit', async () => {
  for (const final of [{ value: { approved: false }, isError: false }, { value: { approved: true }, isError: true }]) {
    const f = fixture(); const r = f.begin();
    await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
    r.deferred.resolve(answer()); await r.result;
    f.final(final.value, final.isError); assert.equal(f.commits.length, 0);
  }
  const f = fixture(); f.begin();
  await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
  f.final(); assert.equal(f.commits.length, 0);
});

test('unknown, expired, wrong-session and invalid choices fail closed', async () => {
  const f = fixture(); const r = f.begin();
  const other = { ...f.agent, session: {} };
  for (const [input, target] of [
    [{ action: 'stage', callId: 'old', selection: choice }, f.agent],
    [{ action: 'stage', callId: 'plan-1', selection: choice }, other],
    [{ action: 'stage', callId: 'plan-1', selection: { ...choice, model: 'missing' } }, f.agent]
  ]) assert.equal((await f.run(input, target)).kind, 'error');
  r.deferred.resolve(answer()); await r.result;
  assert.equal((await f.run({ action: 'stage', callId: 'plan-1', selection: choice })).kind, 'error');
  f.final(); assert.equal(f.commits.length, 0);
});

test('clear on retry prevents an old selection leaking into inherit', async () => {
  const f = fixture(); const r = f.begin();
  await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
  await f.run({ action: 'clear', callId: 'plan-1' });
  r.deferred.resolve(answer()); await r.result; f.final();
  assert.equal(f.commits.length, 0);
});

test('native commit failure stops execution rather than silently changing model', async () => {
  const f = fixture(); const r = f.begin();
  await f.run({ action: 'stage', callId: 'plan-1', selection: choice });
  r.deferred.resolve(answer()); await r.result; f.failCommit(); f.final();
  assert.equal(f.agent.cancelled.kind, 'hook');
  assert.equal(f.errors.length, 1);
  assert.equal(f.agent.current.model, 'A');
});

test('generic questions pass through unchanged', async () => {
  const f = fixture();
  const expected = { answers: [{ id: 'a', selected: ['yes'] }] };
  assert.equal(await f.listeners.get('user-questions/request')({ agent: f.agent, questions: [{ id: 'a' }] }, async () => expected), expected);
});
