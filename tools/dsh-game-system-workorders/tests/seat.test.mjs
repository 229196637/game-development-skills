import test from 'node:test';
import assert from 'node:assert/strict';
import { seatOf } from '../src/client/seat.js';

test('a dock only treats a different drawn session as another seat', () => {
  const mounted = { getSnapshot: () => 'session-b' };
  assert.equal(seatOf('session-a', mounted), 'other', 'A delayed background result must not pop over session B');
  assert.equal(seatOf('session-b', mounted), 'current');
  assert.equal(seatOf('session-a', { getSnapshot: () => undefined }), 'unknown', 'A missing seat is not proof of mismatch');
  assert.equal(seatOf('session-a', undefined, { getSnapshot: () => ({ sessionId: 'session-a' }) }), 'current');
  assert.equal(seatOf('session-a', undefined, { getSnapshot: () => ({ sessionId: 'session-b' }) }), 'other');
  assert.equal(seatOf('session-a', undefined, undefined), 'unknown', 'A host without either service must still render');
});
