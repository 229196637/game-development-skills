import { createOperations } from './runtime.js';
import { unquote } from './operations.js';

export const inject = ['commands', 'tools', 'fs', 'subprocess', 'skills', 'workingDirectory', 'sessionController', 'typert'];
const PROTOCOL = 'game-workorders/1';

export function apply(ctx, config = {}, registerQueries = () => {}) {
  const operations = createOperations(ctx, config);
  registerQueries(ctx, operations);
  const result = (action, data) => ({ kind: 'success', text: JSON.stringify({ protocol: PROTOCOL, action, data }) });
  const guard = handler => async invocation => {
    try { return await handler(invocation); }
    catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : String(error) }; }
  };
  const register = definition => ctx.effect(() => ctx.commands.register({ ...definition, handler: guard(definition.handler) }));
  register({
    name: 'game-tickets', description: '独立查看游戏工单；不等待当前模型执行，不修改工单。', input: { hint: '可留空，自动发现未完成任务' },
    async handler({ agent, rawInput, signal }) {
      const input = rawInput.trim();
      const args = input.startsWith('{') ? JSON.parse(input) : input ? { action: 'snapshot', root: unquote(input) } : { action: 'discover' };
      if (args.action === 'discover' || !args.action) return result('discover', await operations.discover(agent, args, signal));
      if (args.action === 'snapshot') return result('snapshot', await operations.snapshot(agent, args.root, signal));
      if (args.action === 'document') return result('document', await operations.document(agent, args.root, args.file, signal));
      throw new Error('工单查看仅支持 discover、snapshot 和 document。');
    },
  });
  register({
    name: 'game-execute', description: '选择未完成游戏任务，并在当前会话排队执行。', input: { hint: '留空选择任务；也支持任务 README 路径' },
    async handler({ agent, rawInput, commandId, signal }) {
      if (!rawInput.trim()) return result('select', await operations.discover(agent, {}, signal));
      const args = rawInput.trim().startsWith('{') ? JSON.parse(rawInput.trim()) : { root: unquote(rawInput) };
      return result('started', await operations.start(agent, 'execute', args.root, args.requestId || String(commandId), signal));
    },
  });
  register({
    name: 'game-plan', description: '在当前会话规划游戏开发任务；只交付文档与工单，不自动执行。', input: { hint: '输入需要规划的功能需求' },
    async handler({ agent, rawInput, commandId, signal }) {
      const args = rawInput.trim().startsWith('{') ? JSON.parse(rawInput.trim()) : { requirement: rawInput.trim() };
      return result('started', await operations.start(agent, 'plan', args.requirement, args.requestId || String(commandId), signal));
    },
  });
  ctx.effect(() => ctx.tools.register({
    name: 'game_workorders',
    description: '只读发现 game-system 任务、查看工单进度或读取所选任务的入口/工单/职责文档。规划与执行使用游戏命令，由用户确认启动。',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['discover', 'snapshot', 'document'] }, root: { type: 'string', description: 'snapshot/document 的任务目录或 README 路径。' }, file: { type: 'string', description: 'document 的目标路径，必须属于所选任务可查文档。' }, directory: { type: 'string', description: 'discover 的可选扫描子目录，不得越出当前工作目录。' }, query: { type: 'string', description: 'discover 的任务名称或项目搜索词。' }, includeCompleted: { type: 'boolean', description: 'discover 是否包含已完成工单的任务，默认 false。' } }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; } },
    async execute(args, execution) {
      if (!execution.agent) throw new Error('需要绑定当前会话才能查询游戏工单。');
      if (args.action === 'discover') return operations.discover(execution.agent, args, execution.signal);
      if (args.action === 'snapshot') return operations.snapshot(execution.agent, args.root, execution.signal);
      if (args.action === 'document') return operations.document(execution.agent, args.root, args.file, execution.signal);
      throw new Error('不支持的查询操作。');
    },
  }));
}
