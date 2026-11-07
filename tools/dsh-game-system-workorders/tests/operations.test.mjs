import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkorderOperations, unquote } from '../src/host/operations.js';

async function fixture(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-workorder-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const calls = [];
  const snapshots = new Map();
  const io = {
    async resolve(value, options = {}) { const p = path.resolve(options.cwd || cwd, value); let real; try { real = await fs.realpath(p); } catch { real = p; } return { targetKey: real, displayPath: real }; },
    processPath(target) { return target.displayPath; },
    contains(a, b) { const relative = path.relative(a.displayPath, b.displayPath); return !relative.startsWith('..') && !path.isAbsolute(relative); },
    async listDir(target) { return Promise.all((await fs.readdir(target.displayPath, { withFileTypes: true })).map(async item => ({ name: item.name, type: item.isDirectory() || item.isSymbolicLink() ? 'directory' : 'file', target: await io.resolve(path.join(target.displayPath, item.name)) }))); },
    async stat(target) { const s = await fs.stat(target.displayPath); return { type: s.isFile() ? 'file' : 'directory', size: s.size }; },
    readText(target) { return fs.readFile(target.displayPath, 'utf8'); },
  };
  const ops = new WorkorderOperations({ environment: async () => ({ fs: io, cwd, dashboard: async root => { if (!snapshots.has(root)) throw new Error('invalid task'); return snapshots.get(root); } }), prompt: async request => { calls.push(request); return { accepted: true }; } });
  async function task(project, name, updated, counts = { todo: 1, doing: 0, blocked: 0, completed: 0, total: 1 }) {
    const root = path.join(cwd, project, 'docs', '规划', name);
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'README.md'), '<!-- planning-todo:start -->');
    snapshots.set(root, { root, updated, counts, tasks: [] });
    return root;
  }
  return { cwd, io, ops, task, calls, snapshots };
}

test('discovery sorts unfinished tasks and does not submit model prompts', async t => {
  const f = await fixture(t);
  await f.task('A', 'older', '2026-11-01 10:00:00 +08:00');
  await f.task('B', 'newer', '2026-11-07 10:00:00 +08:00');
  await f.task('B', 'finished', '2026-11-08 10:00:00 +08:00', { todo: 0, doing: 0, blocked: 0, completed: 1, total: 1 });
  const result = await f.ops.discover({ id: 'session' });
  assert.deepEqual(result.tasks.map(item => item.name), ['newer', 'older']);
  assert.equal(f.calls.length, 0);
  assert.equal(result.partial, false);
  assert.equal((await f.ops.discover({ id: 's' }, { includeCompleted: true })).tasks.length, 3);
});

test('planning navigation README must not hide real task children', async t => {
  const f = await fixture(t);
  const root = await f.task('A', 'actual', '2026-11-07 10:00:00 +08:00');
  await fs.writeFile(path.join(path.dirname(root), 'README.md'), '# navigation');
  assert.equal((await f.ops.discover({ id: 's' })).tasks.length, 1);
});

test('malformed task is an issue and generated directories are skipped', async t => {
  const f = await fixture(t);
  await f.task('node_modules', 'ignored', '2026-11-07 10:00:00 +08:00');
  const bad = await f.task('A', 'bad', '');
  f.snapshots.delete(bad);
  const result = await f.ops.discover({ id: 's' });
  assert.equal(result.tasks.length, 0);
  assert.equal(result.issues.length, 1);
});

test('reading during a held model prompt is independent and byte-for-byte read-only', async t => {
  const f = await fixture(t);
  const root = await f.task('A', 'active', '2026-11-07 10:00:00 +08:00');
  const before = await fs.readFile(path.join(root, 'README.md'));
  let release;
  let entered;
  const admission = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  f.ops.deps.prompt = async request => { f.calls.push(request); entered(); await held; return { accepted: true }; };
  const pending = f.ops.start({ id: 'busy' }, 'execute', root, 'held_request_12345');
  await admission;
  try {
    const result = await f.ops.snapshot({ id: 'busy' }, root);
    assert.equal(result.counts.todo, 1);
    await f.ops.discover({ id: 'busy' });
    assert.equal(f.calls.length, 1, 'queries must not create any additional prompt');
    assert.deepEqual(await fs.readFile(path.join(root, 'README.md')), before);
    assert.deepEqual(await fs.readdir(root), ['README.md']);
  } finally { release(); await pending; }
});

test('only explicit start admits a queued native prompt and duplicate request is coalesced', async t => {
  const f = await fixture(t);
  const root = await f.task('A', 'active', '2026-11-07 10:00:00 +08:00');
  await Promise.all([f.ops.start({ id: 'busy' }, 'execute', root, 'request_12345'), f.ops.start({ id: 'busy' }, 'execute', root, 'request_12345')]);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].sessionId, 'busy');
  assert.equal(f.calls[0].mode, 'queue');
  assert.match(f.calls[0].content[0].text, /game-system-development-execution/);
});

test('zero-argument execution, root escapes, and unsupported document reads fail', async t => {
  const f = await fixture(t);
  await assert.rejects(f.ops.start({ id: 's' }, 'execute', '', 'request_12345'), /请选择/);
  await assert.rejects(f.ops.target({ id: 's' }, path.dirname(f.cwd)), /工作目录/);
  await assert.rejects(f.ops.discover({ id: 's' }, { directory: path.dirname(f.cwd) }), /工作目录/);
  const root = await f.task('A', 'active', '2026-11-07 10:00:00 +08:00');
  await assert.rejects(f.ops.document({ id: 's' }, root, path.join(root, 'private.txt')), /只能查看/);
  assert.equal(f.calls.length, 0);
});

test('quoted Windows paths remain data rather than shell syntax', () => {
  assert.equal(unquote(JSON.stringify('D:\\games\\my task\\README.md')), 'D:\\games\\my task\\README.md');
});
