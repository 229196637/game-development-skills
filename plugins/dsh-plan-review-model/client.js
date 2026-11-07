window.__ModuleLoader__.load({
  id: '@local/dsh-plan-review-model',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'planExecutionModel';
    const dictionaries = {
      zh: {
        waiting: '计划待审', model: '执行模型', inherit: '继承会话', full: '查看全文',
        approve: '同意执行', discuss: '要求修改', loading: '正在读取模型…',
        effort: '推理等级', defaultEffort: '模型默认', retry: '重试', details: '错误详情',
        loadFailed: '模型列表读取失败，仍可继承会话执行。',
        partial: '部分提供方加载失败；可选择已加载模型或继承会话。',
        submitFailed: '提交失败，请重试。', pending: '正在提交…'
      },
      en: {
        waiting: 'Plan pending review', model: 'Execution model', inherit: 'Use session model', full: 'View full plan',
        approve: 'Approve', discuss: 'Request changes', loading: 'Loading models…',
        effort: 'Reasoning effort', defaultEffort: 'Model default', retry: 'Retry', details: 'Error details',
        loadFailed: 'Could not load models. You can still use the session model.',
        partial: 'Some providers failed to load. Choose an available model or use the session model.',
        submitFailed: 'Could not submit. Try again.', pending: 'Submitting…'
      }
    };
    const css = `
.pem-frame{padding:6px calc(var(--dsh-composer-side-clearance,0px) + 16px) 10px;display:flex;justify-content:center}
.pem-card{width:100%;min-width:0;max-width:var(--dsh-chat-content-width,840px);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);overflow:hidden;font:inherit}
.pem-card,.pem-card *{box-sizing:border-box}
.pem-strip{display:flex;align-items:center;gap:8px;padding:12px 16px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-warn-primary);font-size:14px;line-height:20px}
.pem-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
.pem-preview{margin-left:auto;display:flex;align-items:center;color:var(--dsw-alias-label-secondary);background:none;border:0;font:inherit;font-size:12px;cursor:pointer;gap:6px;padding:0}
.pem-summary{min-width:0;padding:14px 16px 12px}
.pem-title{margin:0;font-size:15px;line-height:22px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pem-description{margin:8px 0 0;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:24px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pem-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px 12px;flex-wrap:wrap}
.pem-fields{display:flex;gap:8px;align-items:center;flex:1 1 220px;min-width:0;flex-wrap:wrap}
.pem-label{display:flex;align-items:center;gap:7px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.pem-label>span{white-space:nowrap}
.pem-select{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;min-height:34px;padding:6px 24px 6px 8px;max-width:290px;min-width:0;text-overflow:ellipsis;color-scheme:inherit}
.pem-buttons{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}
.pem-button{font:inherit;font-size:13px;line-height:20px;min-height:36px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;cursor:pointer;background:transparent;color:var(--dsw-alias-label-primary);white-space:nowrap}
.pem-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.pem-primary{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.pem-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}
.pem-button:disabled,.pem-select:disabled{opacity:.55;cursor:default}
.pem-button:focus-visible,.pem-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pem-notice{flex-basis:100%;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.pem-error{color:var(--dsw-alias-state-error-primary)}
.pem-retry{font:inherit;border:0;background:transparent;color:var(--dsw-alias-brand-primary);cursor:pointer;padding:0 6px}
@media(max-width:720px){.pem-footer{padding:8px 12px 10px}.pem-fields{flex-basis:100%}.pem-select{max-width:min(290px,65vw)}.pem-frame{padding-left:12px;padding-right:12px}}
`;
    function matchPlan({ pendingInteraction }) {
      const pending = pendingInteraction;
      if (pending?.kind !== 'plan-review' || pending.review !== undefined
        || typeof pending.answer !== 'function' || pending.questions?.length !== 1) return null;
      const q = pending.questions[0];
      if (q.intent?.kind !== 'plan-review' || typeof q.intent.callId !== 'string'
        || q.multiSelect === true || typeof q.detail !== 'string'
        || !q.options?.some(o => o.label === q.intent.approve)) return null;
      return pending;
    }
    function stripMarkdown(text) {
      return text.replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
    }
    function ReviewCard(props) {
      const { pending, t, invoke, openPlan, useSidebarMounted, markPreviewOpened } = props;
      const q = pending.questions[0];
      const callId = q.intent.callId;
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [loadError, setLoadError] = React.useState('');
      const [error, setError] = React.useState('');
      const [route, setRoute] = React.useState('');
      const [effort, setEffort] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const submitting = React.useRef(false);
      const generation = React.useRef(0);
      const snapshot = React.useSyncExternalStore(pending.subscribe, pending.snapshot, pending.snapshot);
      const sidebarMounted = useSidebarMounted(value => value !== undefined);
      React.useEffect(() => {
        if (!sidebarMounted || !markPreviewOpened(pending.key)) return;
        try { openPlan(callId); } catch (cause) { setError(String(cause)); }
      }, [sidebarMounted, markPreviewOpened, pending.key, openPlan, callId]);
      const refresh = React.useCallback(async () => {
        const ticket = ++generation.current;
        setLoading(true);
        setLoadError('');
        try {
          const value = await invoke({ action: 'inspect', callId });
          if (generation.current === ticket) setData(value);
        } catch (cause) {
          if (generation.current === ticket) setLoadError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (generation.current === ticket) setLoading(false);
        }
      }, [invoke, callId]);
      React.useEffect(() => {
        refresh();
        return () => { ++generation.current; };
      }, [refresh]);
      const models = data?.catalog?.groups ?? [];
      const current = data?.current;
      const currentName = models.find(g => g.id === current?.provider)?.models.find(m => m.id === current?.model)?.name ?? current?.model;
      const selectedPair = route === '' ? null : JSON.parse(route);
      const selectedModel = selectedPair === null ? undefined
        : models.find(g => g.id === selectedPair[0])?.models.find(m => m.id === selectedPair[1]);
      const canSubmit = snapshot.channel !== 'none' && !snapshot.closed;
      const decide = async (approve) => {
        if (submitting.current || !canSubmit) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        try {
          if (approve) {
            if (selectedPair !== null && !selectedModel) throw new Error(t('loadFailed'));
            // Stage only on Approve, and await its validation before answering.
            // No dropdown-change RPC and no race with the native answer channel.
            await invoke({ action: 'stage', callId, selection: selectedPair === null ? null : {
              provider: selectedPair[0], model: selectedPair[1],
              ...(effort === '' ? {} : { reasoningEffort: effort })
            } });
            const channel = pending.snapshot().channel;
            if (channel === 'none' || pending.snapshot().closed) throw new Error(t('submitFailed'));
            await pending.answer({ answers: [{ id: q.id, selected: [q.intent.approve] }] });
            if (channel === 'rpc') await pending.dismiss();
          } else {
            await pending.dismiss();
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          if (approve) await invoke({ action: 'clear', callId }).catch(() => {});
          setBusy(false);
          submitting.current = false;
        }
      };
      const review = {
        id: q.id, question: q.question, plan: q.detail, callId,
        approve: q.options.find(option => option.label === q.intent.approve),
        decline: q.options.find(option => option.label !== q.intent.approve)
      };
      const paragraphs = stripMarkdown(q.detail).split(/\n\s*\n/).filter(Boolean);
      const title = paragraphs[0]?.split('\n')[0] ?? '';
      const description = paragraphs.slice(1).find(p => p !== title) ?? '';
      return h('div', { className: 'pem-frame', 'data-plan-review-key': pending.key },
        h('style', null, css),
        h('section', { className: 'pem-card', 'aria-label': q.question, 'aria-busy': busy },
          h('div', { className: 'pem-strip' },
            h('span', { className: 'pem-dot', 'aria-hidden': true }), t('waiting'),
            h('button', { className: 'pem-preview', type: 'button', onClick: () => {
              try { openPlan(callId); } catch (cause) { setError(String(cause)); }
            } }, t('full'), h('span', { 'aria-hidden': true }, '›'))),
          h('div', { className: 'pem-summary' },
            h('h3', { className: 'pem-title' }, title),
            description && h('p', { className: 'pem-description' }, description)),
          h('div', { className: 'pem-footer' },
            h('div', { className: 'pem-fields' },
              h('label', { className: 'pem-label' }, h('span', null, t('model')),
                h('select', {
                  className: 'pem-select', value: route, disabled: busy,
                  'aria-label': t('model'), 'data-plan-execution-model': true,
                  onChange: event => { setRoute(event.target.value); setEffort(''); setError(''); }
                },
                h('option', { value: '' }, `${t('inherit')}${currentName ? ' · ' + currentName : ''}`),
                ...models.map(group => h('optgroup', { key: group.id, label: group.name },
                  ...group.models.map(model => h('option', { key: model.id, value: JSON.stringify([group.id, model.id]) }, model.name)))))),
              selectedModel?.reasoning?.efforts?.length > 0 && h('label', { className: 'pem-label' },
                h('span', null, t('effort')),
                h('select', { className: 'pem-select', value: effort, disabled: busy,
                  'aria-label': t('effort'), onChange: event => setEffort(event.target.value) },
                  h('option', { value: '' }, t('defaultEffort')),
                  ...selectedModel.reasoning.efforts.map(item => h('option', { key: item.id, value: item.id }, item.name))))),
            h('div', { className: 'pem-buttons' },
              h('button', { type: 'button', className: 'pem-button', disabled: busy || !canSubmit, onClick: () => decide(false) }, t('discuss')),
              h('button', { type: 'button', className: 'pem-button pem-primary', disabled: busy || !canSubmit,
                title: review.approve.description, onClick: () => decide(true) }, busy ? t('pending') : t('approve'))),
            error && h('div', { className: 'pem-notice pem-error', role: 'alert' }, error),
            !error && loading && h('div', { className: 'pem-notice', role: 'status' }, t('loading')),
            !error && loadError && h('div', { className: 'pem-notice', role: 'status', title: loadError },
              t('loadFailed'), h('button', { className: 'pem-retry', type: 'button', disabled: busy, onClick: refresh }, t('retry')),
              h('details', null, h('summary', null, t('details')), loadError)),
            !error && !loading && !loadError && data?.catalog?.failures?.length > 0
              && h('div', { className: 'pem-notice', role: 'status' }, t('partial')))));
    }
    return {
      // Cordis checks the root property as well as the remote namespace.
      inject: ['slots', 'locale', 'remote', 'remote.commands', 'sidebarRight', 'sessions'],
      apply(ctx) {
        const opened = new Set();
        ctx.effect(() => () => opened.clear(), 'plan-execution-model: preview lifetime');
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'plan-execution-model: dictionaries');
        ctx.slots.inject('conversation.composer', () => ctx.slots.register({
          name: 'conversation.composer', priority: -5, select: matchPlan, locale: NS,
          // Do NOT redeclare the native question composer's child slot. Full-plan
          // navigation uses the existing sidebar resource owner directly instead.
          inject: sessionId => ({
            hooks: { sidebarMounted: ctx.sidebarRight.mounted },
            markPreviewOpened: key => {
              if (opened.has(key)) return false;
              opened.add(key);
              return true;
            },
            openPlan: callId => {
              const child = ctx.sessions.subagentAddress(sessionId);
              const parts = child === undefined ? [sessionId, callId] : [
                'subagent', child.parentSessionId, child.childSessionId, child.mode, callId
              ];
              ctx.sidebarRight.openResource('dsh-resource://plan/' + parts.map(encodeURIComponent).join('/'));
            },
            invoke: async input => {
              const response = await ctx.remote.commands.execute(sessionId, '/plan-execution-model ' + JSON.stringify(input), []);
              if (!response.ok) throw new Error(response.error.message);
              const result = response.value?.result;
              if (result?.kind !== 'success') throw new Error(result?.text ?? 'Plan model command unavailable');
              return JSON.parse(result.text ?? '{}');
            }
          })
        }, props => h(ReviewCard, { ...props, pending: props.matched, key: props.matched.key })));
      }
    };
  }
});
