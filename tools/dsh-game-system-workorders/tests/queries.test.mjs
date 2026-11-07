import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { registerQueries } from '../src/host/queries.js';
import { createDescriptors } from '../src/shared/remotes.js';

test('static query service binds through real Cordis and unloads with its fiber', async () => {
  const root = new Context();
  let contribution;
  const calls = [];
  root.provide('typert', { register(value) { contribution = value; } });
  const operations = Object.fromEntries(['discover', 'snapshot', 'document', 'evidence', 'resolveEvidence'].map(name => [name, (...args) => { calls.push([name, ...args]); return Promise.resolve({ name }); }]));
  const fiber = await root.plugin({ inject: ['typert'], apply(ctx) { registerQueries(ctx, operations); } });
  try {
    const service = root.get('gameWorkorders');
    assert.ok(service);
    assert.equal(service.typertRemote.serviceKey, 'gameWorkorders');
    assert.equal(contribution.face, 'host');
    assert.equal(contribution.invocations.length, 5);
    assert.equal(contribution.model.services[0].key, 'gameWorkorders');
    assert.deepEqual(contribution.model.services[0].members.map(m => m.name), ['discover', 'snapshot', 'document', 'evidence', 'resolveEvidence']);
    const agent = { sessionId: 's' }; const signal = new AbortController().signal;
    assert.deepEqual(await service.discover(agent, {}, signal), { name: 'discover' });
    assert.deepEqual(await service.snapshot(agent, 'root', signal), { name: 'snapshot' });
    assert.deepEqual(await service.document(agent, 'root', 'file', signal), { name: 'document' });
    assert.deepEqual(await service.evidence(agent, 'root', 'task', signal), { name: 'evidence' });
    assert.deepEqual(await service.resolveEvidence(agent, 'root', 'task', 'evidence-id', signal), { name: 'resolveEvidence' });
    assert.deepEqual(calls[3], ['evidence', agent, 'root', 'task', signal]);
    assert.deepEqual(calls[4], ['resolveEvidence', agent, 'root', 'task', 'evidence-id', signal]);
    assert.equal(calls[0][1], agent); assert.equal(calls[0][3], signal);
  } finally { await fiber.dispose(); }
  assert.equal(root.get('gameWorkorders'), undefined);
});

test('shared remote descriptors validate agent lookup, options, paths and JSON result', () => {
  const descriptors = createDescriptors();
  assert.deepEqual(descriptors.map(d => d.method), ['discover', 'snapshot', 'document', 'evidence', 'resolveEvidence']);
  for (const d of descriptors) {
    assert.equal(d.invocation.kind, 'direct'); assert.equal(d.parameters[0].wire, 'agentId');
    assert.equal(d.parameters[0].source, 'lookup'); assert.equal(d.parameters[0].lookup, 'agent');
    assert.equal(d.cancellation.parameter, 'signal');
    assert.throws(() => d.parameters[0].codec.create().parse(''));
    assert.throws(() => d.result.create().parse([]));
    assert.deepEqual(d.result.create().parse({ root: 'x' }), { root: 'x' });
  }
  const parse = descriptors[0].parameters[1].codec.create().parse;
  assert.deepEqual(parse({ directory: '', query: '', includeCompleted: false }), { directory: '', query: '', includeCompleted: false });
  assert.throws(() => parse({ shell: 'oops' })); assert.throws(() => parse({ includeCompleted: 'yes' }));
  assert.deepEqual(descriptors[3].parameters.map(parameter => parameter.name), ['agent', 'root', 'taskId']);
  assert.deepEqual(descriptors[4].parameters.map(parameter => parameter.name), ['agent', 'root', 'taskId', 'evidenceId']);
  for (const descriptor of descriptors.slice(3)) for (const parameter of descriptor.parameters.slice(1)) {
    assert.equal(parameter.codec.mode, 'strict');
    assert.throws(() => parameter.codec.create().parse(''));
    assert.throws(() => parameter.codec.create().parse({ path: 'arbitrary' }));
  }
});
