import { COMMAND, planQuestion, approvedAnswer, approvedResult, normalizeSelection, nativeSelectionOwner, createReviewState } from './core.js';

export const inject = ['commands', 'sessionController'];

export function apply(ctx) {
  const state = createReviewState();
  const controller = ctx.sessionController;
  let disposed = false;
  ctx.effect(() => () => { disposed = true; }, 'plan-execution-model: lifetime');

  ctx.on('user-questions/request', async (request, next) => {
    const question = planQuestion(request.questions);
    if (!question || !request.agent) return next();
    const session = request.agent.session;
    const callId = question.intent.callId;
    const review = state.open(session, question, request.signal);
    try {
      const answer = await next();
      review.approved = approvedAnswer(question, answer);
      review.sealed = true;
      if (!review.approved) state.remove(session, callId);
      return answer;
    } catch (error) {
      state.remove(session, callId);
      throw error;
    }
  }, { prepend: true, global: true });

  ctx.effect(() => ctx.commands.register({
    definitionId: '@local/dsh-plan-review-model',
    name: COMMAND,
    description: '暂存本次计划审核的执行模型；不会批准计划或修改全局默认',
    input: { hint: '<review selection JSON>' },
    recordInput: false,
    handler: async ({ agent, rawInput, signal }) => {
      try {
        const input = JSON.parse(rawInput);
        if (!input || typeof input.callId !== 'string') throw new Error('缺少计划审核标识。');
        const review = state.require(agent.session, input.callId);
        if (input.action === 'clear' || (input.action === 'stage' && input.selection === null)) {
          review.selection = null;
          return { kind: 'success', text: '{}' };
        }
        const owner = nativeSelectionOwner(controller);
        const catalog = await controller.modelCatalog();
        signal.throwIfAborted();
        if (disposed || state.require(agent.session, input.callId) !== review) throw new Error('计划审核已失效。');
        if (input.action === 'inspect') {
          return { kind: 'success', text: JSON.stringify({
            catalog,
            current: owner.selectionFor(agent).current
          }) };
        }
        if (input.action !== 'stage') throw new Error('未知的计划模型操作。');
        review.selection = normalizeSelection(input.selection, catalog);
        return { kind: 'success', text: JSON.stringify({ selected: review.selection }) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
      }
    }
  }), 'plan-execution-model: user command');

  // Observe the authoritative final tool result, not a client-supplied approval.
  // Native commit is synchronous: no next model request can race past it.
  ctx.on('tools/result', (exec, result) => {
    if (exec.name !== 'exit_plan_mode' || !exec.agent) return;
    const agent = exec.agent;
    const review = state.get(agent.session, exec.callId);
    state.remove(agent.session, exec.callId);
    if (!review || !review.approved || !review.selection || !approvedResult(exec, result)) return;
    try {
      if (disposed || exec.signal?.aborted || review.signal?.aborted) return;
      nativeSelectionOwner(controller).selectForNextRequest(agent, review.selection);
    } catch (error) {
      // Fail closed if native persistence/compatibility changes after staging.
      // Approval never silently continues on a different model.
      ctx.logger.error('plan-execution-model: model switch failed; execution stopped: %o', error);
      agent.cancel({ kind: 'hook', reason: '执行模型切换失败，已停止执行。' });
    }
  }, { global: true });
}
