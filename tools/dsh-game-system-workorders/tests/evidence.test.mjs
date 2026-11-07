import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkorderOperations } from '../src/host/operations.js';
import { evidenceReferences } from '../src/host/evidence.js';

async function fixture(t) {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'workorder-evidence-'));
  t.after(() => fs.rm(sandbox, { recursive: true, force: true }));
  const cwd = path.join(sandbox, 'workspace');
  const root = path.join(cwd, 'docs', '规划', '测试任务');
  const ticket = path.join(root, '工单', 'UI.md');
  await fs.mkdir(path.dirname(ticket), { recursive: true });
  await fs.writeFile(ticket, 'existing ticket bytes: 验收自由文字');
  const task = { id: 'UI', file: ticket, latest_tests: [], latest_acceptance: [] };
  const snapshot = { tasks: [task], counts: { total: 1, todo: 1 }, consistency: { stable: true } };
  const reads = [];
  const blocked = new Set();
  const io = {
    async resolve(input, opts = {}) {
      const given = path.resolve(opts.cwd || cwd, input);
      let actual;
      try { actual = await fs.realpath(given); }
      catch (error) { if (error.code !== 'ENOENT') throw error; actual = given; }
      return { targetKey: actual, displayPath: actual };
    },
    processPath: target => target.displayPath,
    contains(parent, child) { const relative = path.relative(parent.displayPath, child.displayPath); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); },
    async stat(target) { try { const info = await fs.stat(target.displayPath); return { type: info.isFile() ? 'file' : 'directory', size: info.size }; } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } },
    async readByteRange(target, { offset, length }) { reads.push(target.displayPath); if (blocked.has(target.displayPath)) throw new Error('FS_PERMISSION: denied'); const handle = await fs.open(target.displayPath); try { const buffer = Buffer.alloc(length); const result = await handle.read(buffer, 0, length, offset); return buffer.subarray(0, result.bytesRead); } finally { await handle.close(); } },
    async readBytes(target, signal, maxBytes) { reads.push(target.displayPath); if (blocked.has(target.displayPath)) throw new Error('FS_PERMISSION: denied'); const bytes = await fs.readFile(target.displayPath); if (bytes.length > maxBytes) throw new Error('FS_TOO_LARGE'); return bytes; },
  };
  const ops = new WorkorderOperations({ environment: async () => ({ fs: io, cwd, dashboard: async () => snapshot, fileAddress: target => ({ scope: 'session', path: target.displayPath }) }), prompt: () => { throw new Error('must never submit prompt'); } });
  const agent = { id: 'session' };
  async function file(relative, content = 'evidence') { const actual = path.resolve(root, relative); await fs.mkdir(path.dirname(actual), { recursive: true }); await fs.writeFile(actual, content); return actual; }
  return { sandbox, cwd, root, ticket, task, snapshot, ops, agent, io, file, reads, blocked };
}

test('standard Markdown parsing supports escaped parentheses, reference links and images but not HTML/code/prose', () => {
  const references = evidenceReferences('![截图][shot]\n\n[报告](<报告 空格.md>)\n\n[括号](a\\(b\\).png)\n\n[shot]: <中文 图.png>\n\n`[not](code.png)`\n\n<img src="unsafe.png">');
  assert.deepEqual(references.map(item => decodeURIComponent(item.href)), ['中文 图.png', '报告 空格.md', 'a(b).png']);
  assert.deepEqual(evidenceReferences('人工验收通过，截图另见群聊'), []);
  assert.deepEqual(evidenceReferences('```md\n![not](code.png)\n```'), []);
  assert.equal(evidenceReferences('./中文 目录/截图.png')[0].href, './中文 目录/截图.png');
});

test('records and direct reports produce canonical paths, stable IDs, one level only and unchanged source bytes', async t => {
  const f = await fixture(t);
  const image = await f.file('工单/中文 空格.png');
  const video = await f.file('reports/演示 视频.mp4');
  const nested = await f.file('reports/nested.md', '[not followed](hidden.png)');
  await f.file('reports/hidden.png');
  const report = await f.file('reports/report.md', '![视频](<演示 视频.mp4>)\n\n[nested](nested.md)\n\n[bad](missing.png)');
  f.task.latest_tests = [{ id: 'T1', report, reportExists: true, result: 'passed' }];
  f.task.latest_acceptance = [{ id: 'A1', evidence: '![截图](<中文 空格.png>)' }, { id: 'A2', evidence: '人工复核通过，无文件证据' }];
  const snapshotBefore = JSON.stringify(f.snapshot);
  const bytesBefore = await fs.readFile(f.ticket);
  const first = await f.ops.evidence(f.agent, f.root, 'UI');
  assert.equal(first.partial, false);
  assert.deepEqual(first.items.map(item => item.path), [report, image, video, nested, path.join(f.root, 'reports', 'missing.png')]);
  assert.deepEqual(first.items.map(item => item.kind), ['report', 'image', 'video', 'report', 'image']);
  assert.equal(first.items.at(-1).exists, false);
  assert.equal(first.items[2].sourceFile, report);
  assert.equal(first.items[1].sourceField, 'latest_acceptance[0].evidence');
  assert.deepEqual((await f.ops.evidence(f.agent, f.root, 'UI')).items.map(item => item.id), first.items.map(item => item.id));
  const resolved = await f.ops.resolveEvidence(f.agent, f.root, 'UI', first.items[1].id);
  assert.deepEqual(resolved.address, { scope: 'session', path: image });
  f.task.latest_acceptance[0].result = 'passed';
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', first.items[1].id), /变更/);
  delete f.task.latest_acceptance[0].result;
  const environment = f.ops.deps.environment;
  f.ops.deps.environment = async (...args) => { const env = await environment(...args); delete env.fileAddress; return env; };
  const fallback = await f.ops.resolveEvidence(f.agent, f.root, 'UI', first.items[1].id);
  assert.equal(fallback.path, image);
  assert.equal(Object.hasOwn(fallback, 'address'), false, 'missing helper must never cause a hand-built URI');
  assert.equal(JSON.stringify(f.snapshot), snapshotBefore);
  assert.deepEqual(await fs.readFile(f.ticket), bytesBefore);
});

test('missing, outside, unsafe URI, malformed encoding and denied files fail as cards without reading outside', async t => {
  const f = await fixture(t);
  const outside = path.join(f.sandbox, 'private.png');
  await fs.writeFile(outside, 'private');
  const denied = await f.file('工单/denied.png');
  f.blocked.add(denied);
  f.task.latest_acceptance = [{ evidence: `[outside](<${outside.replaceAll('\\', '/')}>)\n\n[network](https://example.invalid/a.png)\n\n[bad](broken%ZZ.png)\n\n[missing](missing.png)\n\n[denied](denied.png)` }];
  const result = await f.ops.evidence(f.agent, f.root, 'UI');
  assert.equal(result.items.length, 5);
  assert.ok(result.items.every(item => !item.exists && item.reason));
  assert.equal(result.issues.length, 5);
  assert.equal(f.reads.includes(outside), false);
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', result.items[0].id), /超出/);
});

test('symlink escape is rejected and re-resolve rejects deleted, removed, changed and retargeted evidence', async t => {
  const f = await fixture(t);
  const image = await f.file('工单/a.png');
  const alternate = await f.file('工单/b.png');
  f.task.latest_acceptance = [{ id: 'A1', evidence: './a.png' }];
  const id = (await f.ops.evidence(f.agent, f.root, 'UI')).items[0].id;
  await fs.rm(image);
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', id), /不存在|失效/);
  await fs.writeFile(image, 'restored');
  f.task.latest_acceptance[0].evidence = './b.png';
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', id), /变更/);
  f.task.latest_acceptance = [];
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', id), /变更/);
  const externalDirectory = path.join(f.sandbox, 'external');
  await fs.mkdir(externalDirectory);
  await fs.writeFile(path.join(externalDirectory, 'outside.png'), 'secret');
  const link = path.join(f.root, '工单', 'link');
  try { await fs.symlink(externalDirectory, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.diagnostic('symlink creation unavailable on this host'); return; } throw error; }
  f.task.latest_acceptance = [{ evidence: './link/outside.png' }];
  const escaped = await f.ops.evidence(f.agent, f.root, 'UI');
  assert.equal(escaped.items[0].exists, false);
  assert.match(escaped.items[0].reason, /超出/);
  assert.equal(f.reads.includes(path.join(externalDirectory, 'outside.png')), false);
  // An internal symlink is allowed by canonical containment, but retargeting cannot preserve an old ID.
  const internalDirectory = path.join(f.root, 'internal');
  await fs.mkdir(internalDirectory);
  await fs.writeFile(path.join(internalDirectory, 'outside.png'), 'allowed');
  await fs.rm(link);
  await fs.symlink(internalDirectory, link, process.platform === 'win32' ? 'junction' : 'dir');
  const internal = (await f.ops.evidence(f.agent, f.root, 'UI')).items[0];
  assert.equal(internal.exists, true);
  await fs.rm(link);
  await fs.symlink(externalDirectory, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', internal.id), /变更/);
  assert.ok(alternate);
});

test('report size and global 40-reference bounds are explicit; relative reports preserve cwd semantics', async t => {
  const f = await fixture(t);
  const report = await f.file('large.md', 'x'.repeat(256 * 1024 + 1));
  f.task.latest_tests = [{ report: path.relative(f.cwd, report) }];
  let result = await f.ops.evidence(f.agent, f.root, 'UI');
  assert.equal(result.items[0].path, report);
  assert.equal(result.items[0].exists, true);
  assert.equal(result.partial, true);
  assert.match(result.issues[0].reason, /256 KiB/);
  f.task.latest_tests = [];
  f.task.latest_acceptance = [{ evidence: Array.from({ length: 45 }, (_, index) => `[file](missing${index}.png)`).join('\n\n') }];
  result = await f.ops.evidence(f.agent, f.root, 'UI');
  assert.equal(result.items.length, 40);
  assert.equal(result.partial, true);
  await assert.rejects(f.ops.resolveEvidence(f.agent, f.root, 'UI', '../arbitrary'), /变更/);
  await assert.rejects(f.ops.evidence(f.agent, f.root, 'unknown'), /不存在/);
});
