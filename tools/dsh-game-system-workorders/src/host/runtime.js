import path from 'node:path';
import { WorkorderOperations } from './operations.js';

export function createOperations(ctx, config = {}) {
  return new WorkorderOperations({
    prompt: (request, signal) => ctx.sessionController.prompt(request, signal),
    async environment(agent, signal) {
      const owner = agent.ctx || ctx;
      const fs = owner.get('fs') || ctx.fs;
      const subprocess = owner.get('subprocess') || ctx.subprocess;
      const cwd = ctx.workingDirectory.get(agent.session);
      const skill = await ctx.skills.get('game-system-development-planning', { cwd, scope: owner, signal });
      const base = skill?.resourceBase?.kind === 'directory' ? skill.resourceBase.path : skill?.path ? path.dirname(skill.path) : undefined;
      if (!base) throw new Error('缺少可读取的 game-system-development-planning 技能，请先安装规划与执行技能。');
      const scriptHostPath = path.join(base, 'scripts', 'planning_tool.py');
      const script = fs.processPathFromHostPath(scriptHostPath);
      if (!script) throw new Error('当前执行环境无法访问技能脚本，请将技能安装到同一执行环境。');
      const python = await subprocess.resolveExecutable(config.python || 'python', undefined, signal);
      return {
        fs, cwd,
        async dashboard(root, parentSignal) {
          const timeout = new AbortController();
          const timer = setTimeout(() => timeout.abort(new Error('工单查询超过 30 秒，请缩小任务范围。')), 30000);
          const linked = parentSignal ? AbortSignal.any([parentSignal, timeout.signal]) : timeout.signal;
          try {
            const process = subprocess.spawn({ argv: [python, '-B', script, 'dashboard', '--root', root], cwd, stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 * 1024 }, stderr: { maxBytes: 32 * 1024 } }, graceMs: 1000, signal: linked, env: { PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
            const outcome = await process.done;
            const stdout = process.collected.stdout?.readFrom(0);
            const stderr = process.collected.stderr?.readFrom(0);
            if (stdout?.lossy) throw new Error('工单快照超出 1 MiB，请拆分任务后查看。');
            let value;
            try { value = JSON.parse(stdout?.text || ''); }
            catch { throw new Error(`工单工具没有返回 JSON（退出 ${outcome.exitCode}）：${(stderr?.text || stdout?.text || '').slice(0, 2000)}`); }
            if (outcome.exitCode !== 0 || value.ok !== true) throw new Error(value.error || stderr?.text || '工单读取失败。');
            if (!value.result?.counts || !Array.isArray(value.result.tasks)) throw new Error('工单快照格式不兼容，请更新规划技能。');
            return value.result;
          } finally { clearTimeout(timer); }
        },
      };
    },
  });
}
