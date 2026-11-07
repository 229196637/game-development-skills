import test from 'node:test';
import assert from 'node:assert/strict';
import { createThumbnailPool } from '../src/client/media.js';

const blob = size => new Blob([new Uint8Array(size)]);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('thumbnail pool caps each item and the page, and revokes every URL it hands out', async () => {
  const urls = new Set(); let next = 0; const revoked = [];
  const pool = createThumbnailPool({ createURL: () => { const url = `blob:${++next}`; urls.add(url); return url; }, revokeURL: url => { revoked.push(url); urls.delete(url); } });
  await assert.rejects(pool.load(5 * 1024 * 1024 + 1, async () => blob(1)), /previewTooLarge/);
  assert.deepEqual(pool.stats(), { active: 0, bytes: 0, entries: 0, queued: 0 });
  const first = await pool.load(1024, async () => blob(1024));
  const second = await pool.load(1024, async () => blob(1024));
  first.release(); second.release();
  assert.deepEqual(revoked.sort(), ['blob:1', 'blob:2']);
  assert.equal(urls.size, 0);
  assert.equal(pool.stats().bytes, 0);
});

test('thumbnail pool never exceeds the byte budget and releases reservations on abort', async () => {
  const pool = createThumbnailPool({ maxBytes: 2048, maxItem: 2048 });
  const held = await pool.load(1536, async () => blob(1536));
  await assert.rejects(pool.load(1024, async () => blob(1024)), /previewTooLarge/);
  const controller = new AbortController();
  const pending = pool.load(512, () => new Promise(() => {}), controller.signal);
  assert.equal(pool.stats().bytes, 2048, 'An in-flight load reserves its admitted size before bytes arrive');
  controller.abort();
  await assert.rejects(pending, /previewCancelled/);
  assert.equal(pool.stats().bytes, 1536, 'An aborted in-flight load releases its reservation exactly once');
  held.release();
  assert.equal(pool.stats().bytes, 0);
  pool.dispose();
});

test('disposing the pool cancels in-flight loads and revokes live previews', async () => {
  const revoked = [];
  const pool = createThumbnailPool({ revokeURL: url => revoked.push(url) });
  const live = await pool.load(64, async () => blob(64));
  const controller = new AbortController();
  const queued = pool.load(64, () => new Promise(() => {}), controller.signal);
  pool.dispose();
  await assert.rejects(queued, /previewCancelled/);
  assert.equal(revoked.length, 1);
  await assert.rejects(pool.load(64, async () => blob(64)), /previewCancelled/);
  live.release();
  assert.equal(revoked.length, 1, 'A released entry revokes at most once');
  await tick();
});
