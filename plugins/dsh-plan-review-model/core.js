// Pure review and selection rules, shared by the Host adapter and regression tests.
export const COMMAND = 'plan-execution-model';

export function planQuestion(questions) {
  if (!Array.isArray(questions) || questions.length !== 1) return undefined;
  const q = questions[0];
  return q.intent?.kind === 'plan-review' && typeof q.intent.callId === 'string'
    && typeof q.detail === 'string' && Array.isArray(q.options)
    && q.options.some(option => option.label === q.intent.approve) ? q : undefined;
}

export function approvedAnswer(question, answer) {
  const entries = answer?.answers?.filter(item => item.id === question.id);
  return entries?.length === 1 && entries[0].selected?.length === 1
    && entries[0].selected[0] === question.intent.approve && entries[0].custom === undefined;
}

export function approvedResult(exec, result) {
  return exec.name === 'exit_plan_mode' && !result.isError && result.value?.approved === true;
}

export function normalizeSelection(selection, catalog) {
  if (selection === null) return null;
  if (!selection || typeof selection.provider !== 'string' || typeof selection.model !== 'string') {
    throw new Error('请选择一个可用的执行模型。');
  }
  const group = catalog.groups.find(item => item.id === selection.provider);
  const model = group?.models.find(item => item.id === selection.model);
  if (!model) throw new Error('所选模型已不可用，请重新选择或继承会话模型。');
  const effort = selection.reasoningEffort;
  if (effort !== undefined && !model.reasoning?.efforts.some(item => item.id === effort)) {
    throw new Error('所选推理等级不受该模型支持，请重新选择。');
  }
  return {
    provider: group.id,
    model: model.id,
    ...(effort === undefined ? {} : { reasoningEffort: effort })
  };
}

// Only the native, session-local selection owner is used. Never call selectModel:
// that public Remote also saves the global default. This adapter is deliberately
// isolated and capability-checked for the installed 0.2.1-rc.4 desktop runtime.
export function nativeSelectionOwner(controller) {
  const owner = controller.agents;
  if (!owner || typeof owner.selectionFor !== 'function'
    || typeof owner.selectForNextRequest !== 'function'
    || typeof owner.serializeImageAdmission !== 'function') {
    throw new Error('当前 DSH 版本不支持此执行模型扩展；未更改会话或全局模型。');
  }
  return owner;
}

export function createReviewState() {
  const sessions = new WeakMap();
  return {
    open(session, question, signal) {
      const review = { question, signal, selection: null, sealed: false, approved: false };
      let calls = sessions.get(session);
      if (!calls) sessions.set(session, calls = new Map());
      calls.set(question.intent.callId, review);
      return review;
    },
    get(session, callId) {
      return sessions.get(session)?.get(callId);
    },
    require(session, callId) {
      const review = this.get(session, callId);
      if (!review || review.sealed || review.signal?.aborted) {
        throw new Error('这份计划已不再等待审核，请使用当前计划卡片。');
      }
      return review;
    },
    remove(session, callId) {
      sessions.get(session)?.delete(callId);
    }
  };
}
