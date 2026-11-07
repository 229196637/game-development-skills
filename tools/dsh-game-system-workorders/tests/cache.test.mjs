import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDiscoverCache, createSnapshotCache, fingerprintPaths, looksLikePath } from '../src/host/cache.js';
import { WorkorderOperations } from '../src/host/operations.js';

function filesystem(entries = {}) {
  const files = new Map(Object.entries(entries));
  const io = {
    async resolve(value, options = {}) { const resolved = path.resolve(options.cwd || '/root', value); return { targetKey: resolved, displayPath: resolved }; },
    processPath(target) { return target.displayPath; },
    contains(a, b) { const relative = path.relative(a.displayPath, b.displayPath); return !relative.startsWith('..') && !path.isAbsolute(relative); },
    async stat(target) {
      const entry = files.get(target.displayPath);
      if (!entry) return undefined;
      return { type: entry.type || 'file', size: entry.size ?? 1, version: entry.version };
    },
    async listDir() { return []; },
    readText() { return ''; },
  };
  return { io, files, bump(file, version, type = 'file') { files.set(file, { version, type }); } };
}

const ROOT = path.resolve('/root/docs/规划/task');
function snapshot(overrides = {}) {
  return {
    root: ROOT,
    readme: path.join(ROOT, 'README.md'),
    counts: { todo: 1 },
    tasks: [{ id: 'A', file: path.join(ROOT, 'm', '职责', 'A.md'), document: path.join(ROOT, 'm', 'README.md'), references: [], latest_tests: [{ report: path.join(ROOT, 'docs', '测试', 'r.md') }], latest_acceptance: [{ evidence: 'see docs/测试/r.md' }] }],
    ...overrides,
  };
}

test('fingerprint paths cover tickets, reports and evidence without duplicates', () => {
  const list = fingerprintPaths(snapshot(), ROOT);
  assert.ok(list.includes(path.join(ROOT, 'README.md')));
  assert.ok(list.includes(path.join(ROOT, 'm', '职责', 'A.md')));
  assert.ok(list.includes(path.join(ROOT, 'docs', '测试', 'r.md')));
  assert.equal(new Set(list).size, list.length);
  assert.equal(looksLikePath('docs/测试/r.md'), true);
  assert.equal(looksLikePath('https://example.com/a.png'), false);
  assert.equal(looksLikePath('a sentence with spaces'), false);
});

test('a warm snapshot is served from cache and a version bump invalidates it', async () => {
  const { io, bump } = filesystem({ [path.join(ROOT, 'README.md')]: { version: 'v1' } });
  const cache = createSnapshotCache();
  let produced = 0;
  const produce = async () => { produced += 1; return snapshot(); };
  const first = await cache.run(ROOT, io, produce);
  const second = await cache.run(ROOT, io, produce);
  assert.equal(produced, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.value.root, ROOT);
  bump(path.join(ROOT, 'README.md'), 'v2');
  const third = await cache.run(ROOT, io, produce);
  assert.equal(third.cached, false);
  assert.equal(produced, 2);
});

test('a new sibling file invalidates through the parent directory stamp', async () => {
  const directory = path.dirname(ROOT);
  const { io, bump } = filesystem({ [path.join(ROOT, 'README.md')]: { version: 'v1' }, [directory]: { version: 'd1', type: 'directory' } });
  const cache = createSnapshotCache();
  let produced = 0;
  const produce = async () => { produced += 1; return snapshot(); };
  await cache.run(ROOT, io, produce);
  await cache.run(ROOT, io, produce);
  assert.equal(produced, 1);
  bump(directory, 'd2', 'directory');
  const revalidated = await cache.run(ROOT, io, produce);
  assert.equal(revalidated.cached, false);
  assert.equal(produced, 2);
});

test('entries expire, keep an LRU bound and honour an explicit fresh request', async () => {
  let now = 1000;
  const { io } = filesystem({});
  const cache = createSnapshotCache({ maxEntries: 2, maxAgeMs: 5000, now: () => now });
  let produced = 0;
  const make = value => async () => { produced += 1; return snapshot({ root: value }); };
  await cache.run('A', io, make('A'));
  now = 4000;
  assert.equal((await cache.run('A', io, make('A'))).cached, true);
  now = 7000;
  assert.equal((await cache.run('A', io, make('A'))).cached, false, 'expired entry must be recomputed');
  await cache.run('B', io, make('B'));
  await cache.run('C', io, make('C'));
  assert.equal(cache.size(), 2);
  assert.equal(cache.peek('A'), null, 'least recently used entry is evicted');
  const freshCount = produced;
  await cache.run('C', io, make('C'), undefined, { fresh: true });
  assert.equal(produced, freshCount + 1, 'fresh always recomputes');
  assert.equal(cache.peek('C').snapshot.root, 'C');
});

test('concurrent readers of one root share a single production run', async () => {
  const { io } = filesystem({});
  const cache = createSnapshotCache();
  let produced = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const produce = async () => { produced += 1; await gate; return snapshot(); };
  const controller = new AbortController();
  const first = cache.run(ROOT, io, produce, controller.signal);
  const second = cache.run(ROOT, io, produce);
  controller.abort();
  release();
  const [left, right] = await Promise.all([first, second]);
  assert.equal(produced, 1);
  assert.equal(left.cached, false);
  assert.equal(right.cached, false);
  assert.equal(left.value.root, ROOT);
});

test('discovery cache keys requests, expires and bypasses on demand', async () => {
  let now = 0;
  const cache = createDiscoverCache({ maxAgeMs: 1000, now: () => now });
  let produced = 0;
  const produce = async () => { produced += 1; return { tasks: [] }; };
  const key = cache.keyOf('/cwd', '/cwd/docs', false);
  assert.notEqual(key, cache.keyOf('/cwd', '/cwd/docs', true));
  assert.equal((await cache.run(key, produce)).cached, false);
  assert.equal((await cache.run(key, produce)).cached, true);
  now = 2000;
  assert.equal((await cache.run(key, produce)).cached, false);
  assert.equal(produced, 2);
  await cache.run(key, produce, { fresh: true });
  assert.equal(produced, 3);
});

async function workspace(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'gwo-cache-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const root = path.join(cwd, 'proj', 'docs', '规划', 'task');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'README.md'), '# task\n');
  const stats = new Map();
  let dashboards = 0;
  let version = 0;
  const io = {
    async resolve(value, options = {}) { const resolved = path.resolve(options.cwd || cwd, value); let real; try { real = await fs.realpath(resolved); } catch { real = resolved; } return { targetKey: real, displayPath: real }; },
    processPath(target) { return target.displayPath; },
    contains(a, b) { const relative = path.relative(a.displayPath, b.displayPath); return !relative.startsWith('..') && !path.isAbsolute(relative); },
    async stat(target) {
      let info; try { info = await fs.stat(target.displayPath); } catch { return undefined; }
      // Shape a version the way the DSH fs service does: it must change with content.
      return { type: info.isDirectory() ? 'directory' : 'file', size: info.size, version: `${info.ino}:${info.size}:${info.mtimeMs}` };
    },
    async listDir(target) { return (await fs.readdir(target.displayPath, { withFileTypes: true })).map(item => ({ name: item.name, type: item.isDirectory() ? 'directory' : 'file', target: { targetKey: path.join(target.displayPath, item.name), displayPath: path.join(target.displayPath, item.name) } })); },
    readText(target) { return fs.readFile(target.displayPath, 'utf8'); },
  };
  const snapshotFor = () => ({ root, updated: '2026-11-07 10:00:00 +08:00', counts: { todo: 1, doing: 0, blocked: 0, completed: 0, total: 1 }, tasks: [{ id: 'A', status: 'todo', file: path.join(root, 'a.md'), items: [] }], consistency: { stable: true } });
  const prompts = [];
  const ops = new WorkorderOperations({ environment: async () => ({ fs: io, cwd, dashboard: async () => { dashboards += 1; return snapshotFor(); } }), prompt: async request => { prompts.push(request); return { accepted: true }; } });
  return { cwd, root, ops, prompts, get dashboards() { return dashboards; } };
}

test('operations reuse a warm dashboard read and revalidate after a real edit', async t => {
  const space = await workspace(t);
  const first = await space.ops.snapshot({ id: 's' }, space.root);
  assert.equal(first.cached, false);
  const second = await space.ops.snapshot({ id: 's' }, space.root);
  assert.equal(second.cached, true);
  assert.equal(space.dashboards, 1);
  assert.ok(second.servedAt, 'a cache hit still reports when it was served');
  await fs.appendFile(path.join(space.root, 'README.md'), '\n- changed\n');
  const third = await space.ops.snapshot({ id: 's' }, space.root);
  assert.equal(third.cached, false);
  assert.equal(space.dashboards, 2);
});

test('document reads share the snapshot cache and execution always revalidates', async t => {
  const space = await workspace(t);
  await space.ops.snapshot({ id: 's' }, space.root);
  await space.ops.document({ id: 's' }, space.root, path.join(space.root, 'README.md'));
  assert.equal(space.dashboards, 1, 'document allowlist comes from the cached snapshot');
  const accepted = await space.ops.start({ id: 's' }, 'execute', space.root, 'req-abcdefgh');
  assert.equal(accepted.queued, true);
  assert.equal(space.dashboards, 2, 'execution forces a fresh read');
  assert.equal(space.prompts.length, 1, 'one queued native prompt');
  assert.match(space.prompts[0].content[0].text, /game-system-development-execution/);
});
