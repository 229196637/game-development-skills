window.__ModuleLoader__.load({
  id: '@local/dsh-game-system-workorders',
  factory(require) {
    /* SHARED_REMOTE_DESCRIPTORS */
    const React = require('react');
    const h = React.createElement;
    const NS = 'game-workorders';
    const zh = {
      queryUnavailable: '工单查询服务尚未就绪，请刷新页面后重试。',
      title: '游戏工单', open: '查看工单', close: '收起', refresh: '刷新', search: '搜索任务或所属项目', all: '包含已完成', scan: '扫描子目录（留空使用当前工作目录）', rescan: '重新扫描', choose: '选择任务', execute: '继续执行', confirm: '确认排队执行', cancel: '取消', plan: '启动规划', requirement: '描述需要规划的功能；只生成文档和工单', planning: '规划需求', loading: '读取中…', empty: '未找到未完成任务。可包含已完成任务，或选择更具体的项目目录重新扫描。', partial: '扫描尚未覆盖全部目录，请选择更具体的项目目录。', issues: '需要检查的入口', todo: '待执行', doing: '执行中', blocked: '已阻塞', completed: '已完成', tickets: '工单完成', items: '工作项完成', owner: '领取者', depends: '前置依赖', next: '下一就绪项', none: '无', source: '查看任务入口', ticket: '查看工单原文', responsibility: '查看职责详情', tests: '最新测试', acceptance: '最新验收', evidence: '证据', readAt: '读取时间', updating: '文件正在更新，当前快照可能不是最终状态；请稍后刷新。', closeout: '工单完成不等于合并收尾完成，请以任务入口安排为准。', queued: '已提交当前会话；忙碌时排队，不中断现有工作。', queryHint: '只读查询，不等待模型，也不修改工单。', confirmHint: '将在当前会话执行以下任务；请确认目标。', document: '原文', auto: '自动刷新', selected: '当前任务', failed: '操作失败', changed: '所选任务已不可用，请重新选择。', rows: '任务列表', filter: '工单状态', statusAll: '全部状态', checked: '已勾选', command: '游戏命令', details: '展开详情', project: '所属项目', noItems: '没有工作项', invalid: '响应格式不兼容，请检查插件与技能版本。', pending: '执行确认', readOnly: '独立只读', ready: '可领取', planConfirm: '确认启动规划', noRequirement: '请先填写规划需求。', copied: '复制路径', notVerified: '未记录', latest: '最近更新', snapshotError: '读取失败；保留上次快照供参考。', autoHint: '卡片可见时每 15 秒读取所选任务；隐藏页面时暂停。'
    };
    const en = {
      queryUnavailable: 'The workorder query service is unavailable. Reload the page and retry.',
      title: 'Game workorders', open: 'View tickets', close: 'Collapse', refresh: 'Refresh', search: 'Find a task or project', all: 'Include completed', scan: 'Scan subdirectory (empty uses current directory)', rescan: 'Scan again', choose: 'Choose task', execute: 'Continue execution', confirm: 'Confirm queued execution', cancel: 'Cancel', plan: 'Start planning', requirement: 'Describe a feature to plan; documents and tickets only', planning: 'Planning request', loading: 'Reading…', empty: 'No unfinished tasks found. Include completed tasks, or scan a more specific project directory.', partial: 'The scan is incomplete. Choose a more specific project directory.', issues: 'Entries to inspect', todo: 'To do', doing: 'Doing', blocked: 'Blocked', completed: 'Completed', tickets: 'Tickets complete', items: 'Checklist complete', owner: 'Owner', depends: 'Dependencies', next: 'Next ready ticket', none: 'None', source: 'Read task entry', ticket: 'Read ticket', responsibility: 'Read detailed documentation', tests: 'Latest tests', acceptance: 'Latest acceptance', evidence: 'Evidence', readAt: 'Read at', updating: 'Files are changing; this may not be the final snapshot. Refresh shortly.', closeout: 'Completed tickets do not establish integration or merge closeout. Check the task entry.', queued: 'Queued in the current session without interrupting existing work.', queryHint: 'Read-only; does not wait for the model or alter tickets.', confirmHint: 'This task will execute in the current session. Confirm the target.', document: 'Source document', auto: 'Auto-refresh', selected: 'Current task', failed: 'Operation failed', changed: 'The selected task is no longer available. Select it again.', rows: 'Task list', filter: 'Ticket status', statusAll: 'All states', checked: 'Checked', command: 'Game command', details: 'Show details', project: 'Project', noItems: 'No checklist items', invalid: 'Incompatible response. Check the plugin and skill versions.', pending: 'Execution confirmation', readOnly: 'Independent read-only', ready: 'Ready', planConfirm: 'Confirm planning', noRequirement: 'Enter a planning request first.', copied: 'Copy path', notVerified: 'Not recorded', latest: 'Updated', snapshotError: 'Read failed; the previous snapshot remains for reference.', autoHint: 'Reads the selected task every 15 seconds while visible. Pauses in hidden pages.'
    };
    const css = `
.gwo{color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.55;min-width:0;text-align:left}
.gwo *{box-sizing:border-box}.gwo-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gwo-bar>strong{margin-right:auto}.gwo button,.gwo input,.gwo select,.gwo textarea{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px 9px;min-height:32px}.gwo button{cursor:pointer}.gwo button:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}.gwo button:disabled{opacity:.55;cursor:wait}.gwo :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.gwo input[type=checkbox]{min-height:auto;accent-color:var(--dsw-alias-brand-primary)}.gwo input:not([type=checkbox]),.gwo textarea{width:100%}.gwo textarea{resize:vertical;min-height:90px}.gwo-panel{margin:8px 0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}.gwo-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.gwo-note{margin:8px 0;padding:8px 10px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);overflow-wrap:anywhere}.gwo-error{border-left-color:var(--dsw-alias-state-error-primary)}.gwo-warn{border-left-color:var(--dsw-alias-state-warn-primary)}.gwo-search{margin:8px 0}.gwo-layout{display:grid;grid-template-columns:minmax(180px,30%) minmax(0,1fr);gap:14px;margin-top:12px}.gwo-tasklist{max-height:550px;overflow:auto;display:flex;flex-direction:column;gap:5px}.gwo-tasklist button{text-align:left;display:block;flex-shrink:0;padding:9px}.gwo-tasklist button[aria-selected=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.gwo-path{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--dsw-alias-label-secondary)}.gwo-detail{min-width:0}.gwo-progress{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}.gwo progress{width:100%;height:7px;accent-color:var(--dsw-alias-brand-primary)}.gwo-counts{display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:8px}.gwo-ticket{border-bottom:1px solid var(--dsw-alias-border-l1);padding:9px 0}.gwo-ticket summary{cursor:pointer;overflow-wrap:anywhere}.gwo-state{font-size:11px;border:1px solid var(--dsw-alias-border-l1);padding:1px 5px;border-radius:4px;margin-right:6px}.gwo-state[data-state=doing]{color:var(--dsw-alias-brand-primary)}.gwo-state[data-state=blocked]{color:var(--dsw-alias-state-warn-primary)}.gwo-state[data-state=completed]{color:var(--dsw-alias-state-success-primary)}.gwo-ticket ul{padding-left:20px;margin:8px 0}.gwo-ticket pre,.gwo-doc{white-space:pre-wrap;overflow-wrap:anywhere;max-height:450px;overflow:auto;font:inherit;background:var(--dsw-alias-bg-layer-1);padding:10px;border-radius:5px}.gwo-confirm{padding:10px;border:1px solid var(--dsw-alias-brand-primary);border-radius:6px;margin:10px 0}.gwo-confirm p{margin:5px 0}.gwo-full{padding:12px;max-width:1200px;margin:0 auto}.gwo-plan{margin-top:12px}.gwo-plan>summary{cursor:pointer}.gwo-command{padding:8px 0}.gwo small{font-size:11px}.gwo-chip{display:inline-block;padding:1px 5px;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:4px}.gwo-label{display:flex;align-items:center;gap:5px;font-size:12px}@media(max-width:700px){.gwo-layout{grid-template-columns:1fr}.gwo-tasklist{max-height:190px}.gwo-progress{gap:8px}.gwo-full{padding:8px}}`;

    return {
      inject: ['slots', 'locale', 'remote', 'remote.commands'],
      async apply(ctx) {
        await ctx.remote.$mount({ package: '@local/dsh-game-system-workorders', descriptors: createDescriptors() });
        ctx.effect(() => ctx.locale.register(NS, 'zh', zh));
        ctx.effect(() => ctx.locale.register(NS, 'en', en));
        const t = ctx.locale.bind(NS);
        const stores = new Map();
        let disposed = false;
        const style = () => h('style', null, css);
        function storeFor(id) {
          if (!stores.has(id)) stores.set(id, { sessionId: id, open: false, discovery: null, root: '', snapshot: null, error: '', loading: 0, confirmation: null, listeners: new Set(), request: 0, discoveryRequest: 0, docRequest: 0, pending: false, status: '', doc: null });
          return stores.get(id);
        }
        function update(store, patch) { if (disposed) return; Object.assign(store, patch); store.listeners.forEach(listener => listener()); }
        function useStore(sessionId) {
          const store = storeFor(sessionId);
          const [, render] = React.useState(0);
          React.useEffect(() => { const listener = () => render(value => value + 1); store.listeners.add(listener); return () => store.listeners.delete(listener); }, [store]);
          const [, localeRevision] = React.useState(0);
          React.useEffect(() => ctx.locale.subscribe(() => localeRevision(value => value + 1)), []);
          return store;
        }
        function decode(result) {
          if (!result.ok) throw new Error(result.error?.message || t('failed'));
          const value = result.value?.result;
          if (!value || value.kind === 'error') throw new Error(value?.text || t('failed'));
          let payload;
          try { payload = JSON.parse(value.text); } catch { throw new Error(t('invalid')); }
          if (payload.protocol !== 'game-workorders/1') throw new Error(t('invalid'));
          return payload;
        }
        async function command(store, name, args) {
          if (name === 'game-tickets') {
            // Background reads never enter commands.execute or append command history.
            const { action, ...options } = args;
            // $mount provides this namespace in a sibling fiber after activation.
            // Parent `remote` injection does not authorize dotted property access;
            // optional get is required here (a hard dependency would deadlock $mount).
            const queries = ctx.get('remote.gameWorkorders');
            if (!queries) throw new Error(t('queryUnavailable'));
            let response;
            if (action === 'discover') response = await queries.discover(store.sessionId, options);
            else if (action === 'snapshot') response = await queries.snapshot(store.sessionId, options.root);
            else if (action === 'document') response = await queries.document(store.sessionId, options.root, options.file);
            else throw new Error(t('invalid'));
            if (!response.ok) throw new Error(response.error?.message || t('failed'));
            if (!response.value || typeof response.value !== 'object') throw new Error(t('invalid'));
            return { protocol: 'game-workorders/1', action, data: response.value };
          }
          const line = `/${name}${args === undefined ? '' : ` ${JSON.stringify(args)}`}`;
          return decode(await ctx.remote.commands.execute(store.sessionId, line, []));
        }
        function preferenceKey(store) { return `gwo:selected:${store.sessionId}:${store.discovery?.cwd || ''}`; }
        function saved(store) { try { return localStorage.getItem(preferenceKey(store)) || ''; } catch { return ''; } }
        function remember(store, root) { try { localStorage.setItem(preferenceKey(store), root); } catch {} }
        async function select(store, root) {
          const token = ++store.request;
          const changed = store.root !== root;
          if (changed) ++store.docRequest;
          update(store, { root, loading: store.loading + 1, error: '', ...(changed ? { snapshot: null, doc: null, confirmation: null } : {}) });
          try {
            const payload = await command(store, 'game-tickets', { action: 'snapshot', root });
            if (token !== store.request || root !== store.root) return;
            remember(store, root);
            update(store, { snapshot: payload.data });
          } catch (error) { if (token === store.request) update(store, { error: `${t('snapshotError')} ${error.message}` }); }
          finally { update(store, { loading: Math.max(0, store.loading - 1) }); }
        }
        function clearSelection(store) {
          ++store.request;
          ++store.docRequest;
          update(store, { root: '', snapshot: null, doc: null, confirmation: null });
        }
        function adoptSnapshot(store, snapshot) {
          ++store.request;
          ++store.docRequest;
          update(store, { root: snapshot.root, snapshot, doc: null, confirmation: null, error: '' });
          remember(store, snapshot.root);
        }
        async function discover(store, options = {}) {
          const token = ++store.discoveryRequest;
          const selection = store.request;
          update(store, { loading: store.loading + 1, error: '' });
          try {
            const payload = await command(store, 'game-tickets', { action: 'discover', ...options });
            if (token !== store.discoveryRequest) return;
            update(store, { discovery: payload.data });
            if (selection !== store.request) return;
            const root = payload.data.tasks.find(task => task.root === store.root)?.root || payload.data.tasks.find(task => task.root === saved(store))?.root || payload.data.tasks[0]?.root;
            if (root) await select(store, root);
            else clearSelection(store);
          } catch (error) { if (token === store.discoveryRequest) update(store, { error: error.message }); }
          finally { update(store, { loading: Math.max(0, store.loading - 1) }); }
        }
        function adoptDiscovery(store, discovery) {
          ++store.discoveryRequest;
          update(store, { discovery, open: true });
          const root = discovery.tasks.find(task => task.root === store.root)?.root || discovery.tasks.find(task => task.root === saved(store))?.root || discovery.tasks[0]?.root;
          if (root) select(store, root);
          else clearSelection(store);
        }
        function closeDocument(store) { ++store.docRequest; update(store, { doc: null }); }
        async function readDocument(store, file) {
          const root = store.root;
          const token = ++store.docRequest;
          update(store, { loading: store.loading + 1, error: '' });
          try {
            const payload = await command(store, 'game-tickets', { action: 'document', root, file });
            if (root === store.root && token === store.docRequest) update(store, { doc: payload.data });
          } catch (error) { if (root === store.root && token === store.docRequest) update(store, { error: error.message }); }
          finally { update(store, { loading: Math.max(0, store.loading - 1) }); }
        }
        async function start(store, action, value) {
          if (store.pending) return;
          update(store, { pending: true, error: '', status: '' });
          const requestId = `gwo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          try {
            await command(store, action === 'execute' ? 'game-execute' : 'game-plan', action === 'execute' ? { root: value, requestId } : { requirement: value, requestId });
            update(store, { confirmation: null, status: t('queued') });
          } catch (error) { update(store, { error: error.message }); }
          finally { update(store, { pending: false }); }
        }
        function button(text, onClick, props = {}) { return h('button', { type: 'button', onClick, ...props }, text); }
        function line(label, value) { return h('div', { className: 'gwo-muted' }, `${label}: ${value || t('none')}`); }
        function Ticket({ task, store }) {
          const items = task.items || [];
          const required = task.latest_tests || [];
          const acceptance = task.latest_acceptance || [];
          return h('details', { className: 'gwo-ticket' },
            h('summary', null, h('span', { className: 'gwo-state', 'data-state': task.status }, t(task.status)), h('strong', null, task.id), ' ', task.class || '', task.claim ? ` (${task.claim})` : ''),
            line(t('depends'), (task.depends_on || []).join(', ')),
            line(t('owner'), task.claim),
            h('ul', null, ...items.map((item, index) => h('li', { key: index }, `${item[0] === 'x' || item[0] === 'X' || item[0] === true ? '☑' : '☐'} ${item[1]}`))),
            h('div', { className: 'gwo-bar' }, button(t('ticket'), () => readDocument(store, task.file)), task.document && button(t('responsibility'), () => readDocument(store, task.document))),
            h('details', null, h('summary', null, t('tests')), required.length ? h('ul', null, ...required.map((item, index) => h('li', { key: index }, `${item.id}: ${item.result}`, item.report ? ` — ${item.report}` : '', item.reportExists === false ? ' ⚠' : ''))) : h('p', { className: 'gwo-muted' }, t('notVerified'))),
            h('details', null, h('summary', null, t('acceptance')), acceptance.length ? h('ul', null, ...acceptance.map((item, index) => h('li', { key: index }, `${item.id}: ${item.result} — ${item.actual || ''}`, item.evidence ? h('div', { className: 'gwo-path' }, String(item.evidence)) : null))) : h('p', { className: 'gwo-muted' }, t('notVerified'))));
        }
        function App({ sessionId, full = false }) {
          const store = useStore(sessionId);
          const [query, setQuery] = React.useState('');
          const [directory, setDirectory] = React.useState('');
          const [all, setAll] = React.useState(false);
          const [filter, setFilter] = React.useState('');
          const [auto, setAuto] = React.useState(true);
          const [requirement, setRequirement] = React.useState('');
          React.useEffect(() => { if (!store.discovery && !store.loading) discover(store); }, [store]);
          React.useEffect(() => {
            if (!auto || !store.root) return;
            // Shared throttle keeps simultaneous dock/view mounts from issuing duplicate polls.
            const timer = setInterval(() => {
              if (document.visibilityState !== 'visible' || store.loading || Date.now() - (store.lastPoll || 0) < 14000) return;
              store.lastPoll = Date.now(); select(store, store.root);
            }, 15000);
            return () => clearInterval(timer);
          }, [store, store.root, auto]);
          const snapshot = store.snapshot;
          const tasks = (store.discovery?.tasks || []).filter(task => `${task.name} ${task.project}`.toLowerCase().includes(query.toLowerCase()));
          const percent = snapshot?.progress?.percent || 0;
          const checked = snapshot?.progress?.itemsChecked || 0;
          const totalItems = snapshot?.progress?.itemsTotal || 0;
          return h('section', { className: `gwo ${full ? 'gwo-full' : 'gwo-panel'}`, 'aria-label': t('title') }, style(),
            h('div', { className: 'gwo-bar' }, h('strong', null, t('title')), h('span', { className: 'gwo-chip' }, t('readOnly')), button(t('refresh'), () => store.root ? select(store, store.root) : discover(store, { directory, includeCompleted: all }), { disabled: store.loading > 0 }), !full && button(t('close'), () => update(store, { open: false }))),
            h('div', { className: 'gwo-muted' }, t('queryHint')),
            store.error && h('div', { role: 'alert', className: 'gwo-note gwo-error' }, store.error),
            store.status && h('div', { role: 'status', className: 'gwo-note' }, store.status),
            store.loading > 0 && h('div', { role: 'status', className: 'gwo-muted' }, t('loading')),
            h('div', { className: 'gwo-search' }, h('input', { 'aria-label': t('search'), placeholder: t('search'), value: query, onChange: event => setQuery(event.target.value) })),
            h('div', { className: 'gwo-bar' }, h('label', { className: 'gwo-label' }, h('input', { type: 'checkbox', checked: all, onChange: event => { setAll(event.target.checked); discover(store, { directory, includeCompleted: event.target.checked }); } }), t('all')), h('label', { className: 'gwo-label', title: t('autoHint') }, h('input', { type: 'checkbox', checked: auto, onChange: event => setAuto(event.target.checked) }), t('auto'))),
            h('details', null, h('summary', { className: 'gwo-muted' }, t('rescan')), h('input', { 'aria-label': t('scan'), placeholder: t('scan'), value: directory, onChange: event => setDirectory(event.target.value) }), button(t('rescan'), () => discover(store, { directory, includeCompleted: all }), { disabled: store.loading > 0 })),
            store.discovery?.partial && h('div', { className: 'gwo-note gwo-warn' }, t('partial')),
            store.discovery?.issues?.length > 0 && h('details', { className: 'gwo-note gwo-warn' }, h('summary', null, `${t('issues')} (${store.discovery.issues.length})`), ...store.discovery.issues.map((issue, index) => h('p', { key: index, className: 'gwo-path' }, `${issue.path}: ${issue.error}`))),
            !tasks.length && !store.loading && h('p', { className: 'gwo-note' }, t('empty')),
            h('div', { className: 'gwo-layout' },
              h('div', { className: 'gwo-tasklist', role: 'listbox', 'aria-label': t('choose') }, ...tasks.map(task => h('button', { type: 'button', key: task.root, role: 'option', 'aria-selected': store.root === task.root, onClick: () => select(store, task.root), onKeyDown: event => { if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return; event.preventDefault(); const index = tasks.indexOf(task); const next = tasks[(index + (event.key === 'ArrowDown' ? 1 : tasks.length - 1)) % tasks.length]; select(store, next.root); event.currentTarget.parentElement.querySelectorAll('[role=option]')[(index + (event.key === 'ArrowDown' ? 1 : tasks.length - 1)) % tasks.length]?.focus(); } }, h('strong', null, task.name), h('span', { className: 'gwo-path' }, task.project), h('small', null, `${task.counts.completed}/${task.counts.total} · ${task.updated || ''}`)))),
              snapshot && h('div', { className: 'gwo-detail' },
                h('strong', null, store.root.split(/[\\/]/).pop()), h('span', { className: 'gwo-path' }, store.root),
                h('div', { className: 'gwo-progress' }, h('div', null, `${t('tickets')}: ${snapshot.counts.completed}/${snapshot.counts.total}`, h('progress', { max: 100, value: percent })), h('div', null, `${t('items')}: ${checked}/${totalItems}`, h('progress', { max: Math.max(1, totalItems), value: checked }))),
                h('div', { className: 'gwo-counts' }, ...['todo', 'doing', 'blocked', 'completed'].map(state => h('span', { key: state }, `${t(state)} ${snapshot.counts[state] || 0}`))),
                line(t('next'), snapshot.next?.id || snapshot.ready?.[0]),
                snapshot.consistency?.stable === false && h('div', { className: 'gwo-note gwo-warn' }, t('updating')),
                h('div', { className: 'gwo-bar' }, button(t('execute'), () => update(store, { confirmation: { action: 'execute', value: store.root } }), { disabled: store.pending || store.loading > 0 || snapshot.consistency?.stable === false }), button(t('source'), () => readDocument(store, snapshot.readme))),
                h('p', { className: 'gwo-muted' }, t('closeout')),
                h('select', { 'aria-label': t('filter'), value: filter, onChange: event => setFilter(event.target.value) }, h('option', { value: '' }, t('statusAll')), ...['todo', 'doing', 'blocked', 'completed'].map(state => h('option', { key: state, value: state }, t(state)))),
                ...(snapshot.tasks || []).filter(task => !filter || task.status === filter).map(task => h(Ticket, { key: task.id, task, store })),
                h('div', { className: 'gwo-muted' }, `${t('readAt')}: ${snapshot.readAt || ''}`))),
            store.doc && h('section', null, h('div', { className: 'gwo-bar' }, h('strong', null, t('document')), button(t('close'), () => closeDocument(store))), h('span', { className: 'gwo-path' }, store.doc.file), h('pre', { className: 'gwo-doc' }, store.doc.content)),
            h('details', { className: 'gwo-plan' }, h('summary', null, t('planning')), h('textarea', { 'aria-label': t('requirement'), placeholder: t('requirement'), value: requirement, onChange: event => setRequirement(event.target.value) }), button(t('plan'), () => requirement.trim() ? update(store, { confirmation: { action: 'plan', value: requirement.trim() } }) : update(store, { error: t('noRequirement') }), { disabled: store.pending })),
            store.confirmation && h('div', { role: 'region', 'aria-label': t('pending'), className: 'gwo-confirm' }, h('strong', null, store.confirmation.action === 'execute' ? t('confirmHint') : t('planning')), h('p', { className: 'gwo-path' }, store.confirmation.value), h('div', { className: 'gwo-bar' }, button(store.confirmation.action === 'execute' ? t('confirm') : t('planConfirm'), () => start(store, store.confirmation.action, store.confirmation.value), { disabled: store.pending }), button(t('cancel'), () => update(store, { confirmation: null }), { disabled: store.pending }))));
        }
        function Dock({ sessionId }) {
          const store = useStore(sessionId);
          return store.open ? h(App, { sessionId }) : h('div', { className: 'gwo gwo-bar' }, style(), button(t('open'), () => update(store, { open: true })), h('small', { className: 'gwo-muted' }, t('queryHint')));
        }
        function Composer(props) {
          const store = useStore(props.sessionId);
          const input = props.useInput(value => value);
          const match = /^\/game-execute(?:[ \t]+(.*))?$/.exec(input.draft || '');
          const eligible = !!match && !(input.occurrences || []).length && !(input.attachmentIds || []).length;
          React.useEffect(() => { if (eligible && !store.discovery && !store.loading) discover(store); }, [eligible, store]);
          const candidates = eligible ? (store.discovery?.tasks || []).filter(task => `${task.name} ${task.root}`.toLowerCase().includes((match[1] || '').toLowerCase())).slice(0, 8) : [];
          function complete(task) {
            // Re-read the captured revision from this render: never replace a newer draft,
            // a submission, or text containing reference chips after asynchronous discovery.
            const revision = input.draftRev;
            const span = props.inputActions.captureInsertion();
            if (span.draftRev !== revision || ['adjudicating', 'submitting'].includes(input.phase)) return;
            props.inputActions.setDraft(`/game-execute ${JSON.stringify(task.root)}`);
            props.inputActions.persistDraft();
            update(store, { open: true });
            select(store, task.root);
          }
          return h('div', null, eligible && h('div', { className: 'gwo gwo-panel' }, style(), h('strong', null, t('choose')), store.loading > 0 && h('div', null, t('loading')), ...candidates.map(task => button(`${task.name} · ${task.project}`, () => complete(task), { key: task.root }))), h(Dock, { sessionId: props.sessionId }));
        }
        function CommandCard({ sessionId, node }) {
          const store = useStore(sessionId);
          let payload;
          try { payload = JSON.parse(node.outcome?.text || 'null'); } catch {}
          const error = node.outcome?.kind === 'error' ? node.outcome.text : '';
          return h('div', { className: 'gwo gwo-command' }, style(), h('strong', null, node.name || t('command')), ' ', button(t('open'), () => {
            update(store, { open: true });
            if (payload?.protocol === 'game-workorders/1' && ['select', 'discover'].includes(payload.action)) {
              adoptDiscovery(store, payload.data);
            }
          }), !node.outcome ? h('div', { className: 'gwo-muted' }, t('loading')) : error ? h('div', { className: 'gwo-note gwo-error', role: 'alert' }, error) : h('div', { className: 'gwo-muted' }, payload?.action === 'started' ? t('queued') : t('queryHint')));
        }
        // The native command UI emits this after its direct Remote admission. Plugin-owned
        // polling uses the Remote itself and does not emit the local acknowledgment again.
        ctx.on('command/executed', (sessionId, name, result) => {
          if (!['game-tickets', 'game-execute', 'game-plan'].includes(name)) return;
          const store = storeFor(sessionId);
          if (result.kind === 'error') { update(store, { open: true, error: result.text }); return; }
          try {
            const payload = JSON.parse(result.text);
            if (payload.protocol !== 'game-workorders/1') return;
            if (payload.action === 'started') update(store, { status: t('queued') });
            else if (payload.action === 'snapshot') { adoptSnapshot(store, payload.data); update(store, { open: true }); }
            else if (payload.action === 'discover' || payload.action === 'select') adoptDiscovery(store, payload.data);
          } catch {}
        });
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({ name: 'conversation.composer.dock', id: 'game-system-workorders', order: 20 }, Composer));
        ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'game-system-workorders', order: 35, label: () => t('title') }, props => h(App, { sessionId: props.sessionId, full: true })));
        ctx.slots.inject('conversation.chat.commandview', () => {
          const disposers = ['game-tickets', 'game-execute', 'game-plan'].map(key => ctx.slots.register({ name: 'conversation.chat.commandview', key }, CommandCard));
          return () => disposers.forEach(dispose => dispose());
        });
        ctx.effect(() => () => { disposed = true; stores.forEach(store => store.listeners.clear()); stores.clear(); });
      },
    };
  },
});
