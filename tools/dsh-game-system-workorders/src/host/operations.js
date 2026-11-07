import path from 'node:path';

const SKIP = new Set(['node_modules', '.git', '.dsh', '.codex', '.agents', 'Library', 'Temp', 'obj', 'bin', 'dist', 'build', 'target', 'coverage', 'vendor', 'dsh-game-system-workorders', 'dsh-game-system-workorders-backup']);
const MAX_DIRECTORIES = 1500;
const MAX_ENTRIES = 15000;
const MAX_TASKS = 100;

export function unquote(value = '') {
  const text = value.trim();
  if (text.startsWith('"') && text.endsWith('"')) return JSON.parse(text);
  return text;
}

/** Application operations shared by native commands and the read-only agent tool. */
export class WorkorderOperations {
  constructor(deps) {
    this.deps = deps;
    this.activeStarts = new Map();
  }

  async discover(agent, options = {}, signal) {
    const { fs, cwd, dashboard } = await this.deps.environment(agent, signal);
    const base = await fs.resolve(cwd, { signal });
    const start = options.directory ? await fs.resolve(options.directory, { cwd, signal }) : base;
    if (!fs.contains(base, start)) throw new Error('扫描目录必须位于当前会话工作目录内。');
    const startParts = fs.processPath(start).split(/[\\/]+/);
    const inPlanning = startParts.some((part, index) => part === 'docs' && startParts[index + 1] === '规划');
    const queue = [{ target: start, depth: 0, planning: inPlanning }];
    const visited = new Set();
    const candidates = [];
    const issues = [];
    let directories = 0;
    let entriesRead = 0;
    let partial = false;
    while (queue.length && directories < MAX_DIRECTORIES && entriesRead < MAX_ENTRIES && candidates.length < MAX_TASKS) {
      signal?.throwIfAborted();
      const current = queue.shift();
      // FsTarget identity remains opaque; it is only used as a set key.
      if (visited.has(current.target.targetKey)) continue;
      visited.add(current.target.targetKey);
      if (!fs.contains(base, current.target)) continue;
      let entries;
      try { entries = await fs.listDir(current.target, signal); }
      catch (error) { issues.push({ path: current.target.displayPath, error: String(error.message || error) }); continue; }
      directories++;
      entriesRead += entries.length;
      const isPlanningIndex = path.basename(fs.processPath(current.target)) === '规划';
      const isTaskRoot = current.planning && !isPlanningIndex && entries.some(entry => entry.name.toLowerCase() === 'readme.md' && entry.type === 'file');
      if (isTaskRoot) {
        const readme = entries.find(entry => entry.name.toLowerCase() === 'readme.md' && entry.type === 'file');
        candidates.push({ root: fs.processPath(current.target), readme: fs.processPath(readme.target) });
      }
      for (const entry of entries) {
        if (entry.type !== 'directory' || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
        if (!fs.contains(base, entry.target)) {
          issues.push({ path: entry.target.displayPath, error: '跳过指向工作目录外的目录。' });
          continue;
        }
        // Under docs only traverse 规划; inside a planning tree only task roots are needed.
        const parentName = path.basename(fs.processPath(current.target));
        if (parentName === 'docs' && entry.name !== '规划') continue;
        if (isTaskRoot) continue;
        if (current.depth >= 6) { partial = true; continue; }
        queue.push({ target: entry.target, depth: current.depth + 1, planning: current.planning || (parentName === 'docs' && entry.name === '规划') });
      }
    }
    partial ||= queue.length > 0;
    const tasks = [];
    for (const candidate of candidates) {
      signal?.throwIfAborted();
      try {
        const snapshot = await dashboard(candidate.root, signal);
        const counts = snapshot.counts;
        const total = counts.total ?? Object.values(counts).reduce((sum, value) => sum + value, 0);
        const remaining = total - counts.completed;
        if (options.includeCompleted || remaining > 0) {
          tasks.push({ ...candidate, name: path.basename(candidate.root), project: path.dirname(path.dirname(path.dirname(candidate.root))), updated: snapshot.updated ?? '', counts: { ...counts, total }, remaining });
        }
      } catch (error) { issues.push({ path: candidate.readme, error: String(error.message || error) }); }
    }
    tasks.sort((a, b) => {
      const at = Date.parse(a.updated) || 0;
      const bt = Date.parse(b.updated) || 0;
      return bt - at || a.root.localeCompare(b.root);
    });
    const query = String(options.query || '').trim().toLowerCase();
    return { schemaVersion: 1, cwd, tasks: tasks.filter(task => !query || `${task.name} ${task.project}`.toLowerCase().includes(query)), issues, partial, scanned: { directories, entries: entriesRead, candidates: candidates.length }, limits: { directories: MAX_DIRECTORIES, entries: MAX_ENTRIES, tasks: MAX_TASKS, depth: 6 }, readAt: new Date().toISOString() };
  }

  async target(agent, input, signal) {
    const env = await this.deps.environment(agent, signal);
    const base = await env.fs.resolve(env.cwd, { signal });
    const supplied = unquote(input);
    if (!supplied) throw new Error('请先从工单选择器中选择任务。');
    const resolved = await env.fs.resolve(supplied, { cwd: env.cwd, signal });
    if (!env.fs.contains(base, resolved)) throw new Error('任务必须位于当前会话工作目录内。');
    const suppliedPath = env.fs.processPath(resolved);
    const root = path.basename(suppliedPath).toLowerCase() === 'readme.md' ? path.dirname(suppliedPath) : suppliedPath;
    const rootTarget = await env.fs.resolve(root, { signal });
    if (!env.fs.contains(base, rootTarget)) throw new Error('任务目录越界。');
    const parts = root.split(/[\\/]+/);
    if (!parts.some((part, index) => part === 'docs' && parts[index + 1] === '规划')) throw new Error('请选择 docs/规划/ 下的任务入口。');
    return { ...env, root, readme: path.join(root, 'README.md') };
  }

  async snapshot(agent, root, signal) {
    const target = await this.target(agent, root, signal);
    const snapshot = await target.dashboard(target.root, signal);
    return { ...snapshot, root: target.root, readme: target.readme, readAt: new Date().toISOString() };
  }

  async document(agent, root, file, signal) {
    const target = await this.target(agent, root, signal);
    const snapshot = await target.dashboard(target.root, signal);
    const allowed = [target.readme, ...(snapshot.tasks || []).flatMap(task => [task.file, task.document]).filter(Boolean).map(item => path.resolve(target.root, item))];
    const resolved = await target.fs.resolve(file, { cwd: target.root, signal });
    const actual = target.fs.processPath(resolved);
    const base = await target.fs.resolve(target.cwd, { signal });
    if (!target.fs.contains(base, resolved) || !allowed.some(item => path.normalize(item) === path.normalize(actual))) throw new Error('只能查看所选任务入口、工单或其直接职责文档。');
    const info = await target.fs.stat(resolved, signal);
    if (!info || info.type !== 'file') throw new Error('文档不存在或不是普通文件。');
    if ((info.size || 0) > 256 * 1024) throw new Error('文档超过 256 KiB，请通过原文路径查看。');
    return { file: actual, content: await target.fs.readText(resolved, signal) };
  }

  async start(agent, action, input, requestId, signal) {
    if (!['plan', 'execute'].includes(action)) throw new Error('不支持的启动动作。');
    if (!requestId || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('启动请求缺少有效的幂等标识。');
    const key = `${agent.id}:${requestId}`;
    if (this.activeStarts.has(key)) return this.activeStarts.get(key);
    const promise = this.submit(agent, action, input, requestId, signal);
    this.activeStarts.set(key, promise);
    try { return await promise; }
    catch (error) { this.activeStarts.delete(key); throw error; }
    finally { if (this.activeStarts.size > 200) this.activeStarts.delete(this.activeStarts.keys().next().value); }
  }

  async submit(agent, action, input, requestId, signal) {
    const text = String(input || '').trim();
    if (!text) throw new Error(action === 'plan' ? '请填写规划需求。' : '请选择任务后再启动执行。');
    let prompt;
    let root;
    if (action === 'execute') {
      const target = await this.target(agent, text, signal);
      const snapshot = await target.dashboard(target.root, signal);
      // Completed class tickets can still require task-level integration or merge closeout.
      if (!snapshot.consistency?.stable && snapshot.consistency) throw new Error('工单正在更新，请刷新后再确认执行。');
      root = target.root;
      prompt = `请调用 game-system-development-execution 技能，落实已选任务。任务入口：${target.readme}\n先读取最新 TODO、领取状态和真实文档，再按既有依赖、owner、测试验收及完成门禁执行；不要抢占其他持有人，不把工单完成等同于合并收尾，不自动推送。仅执行此任务根已授权范围。`;
    } else {
      prompt = `请调用 game-system-development-planning 技能，根据以下需求研究并先完成文档，再交付逐类工单和依赖 TODO。本次只规划，不实现业务、不自动启动执行。API 文档简明说明用途与公开签名，具体操作和内部协作细节放职责文档。\n用户需求：\n${text}`;
    }
    await this.deps.prompt({ requestId, sessionId: agent.id, mode: 'queue', content: [{ type: 'text', text: prompt }], clientTimeZone: 'Asia/Shanghai' }, signal);
    return { accepted: true, queued: true, action, root, requestId, message: '已提交当前会话；忙碌时排队，不会中断正在执行的工作。' };
  }
}
