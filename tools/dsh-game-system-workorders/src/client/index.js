window.__ModuleLoader__.load({
  id: '@local/dsh-game-system-workorders',
  factory(require) {
    /* SHARED_REMOTE_DESCRIPTORS */
    /* WORKBENCH_COMPONENTS */
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
    Object.assign(zh, { work: '工作项', documents: '文档', sections: '工单详情分区', blockedBy: '等待前置', expected: '预期', actual: '实际', recordedAt: '记录时间', passed: '通过', failed: '未通过', 'not-run': '未执行', viewEvidence: '查看验收证据', evidenceText: '原始证据说明', image: '图片证据', openPreview: '打开预览', playOpen: '播放 / 打开', previewHint: '证据仅供核对，可预览不代表验收通过。完整文件在侧栏打开；不调用模型。', noEvidence: '没有可识别的文件引用，原始说明请查看验收页。', evidencePartial: '证据列表已达读取上限，部分内容未展开。', missingEvidence: '文件已失效或不可读取', previewUnavailable: '预览服务不可用，请检查侧栏/媒体插件；文件路径仍保留。', previewTooLarge: '超过缩略图预算，请打开完整预览。', previewUnreadable: '图片格式或内容无法预览，请打开文件检查。', dialogUnavailable: '当前浏览器不支持工单弹窗，请使用工单会话视图。' });
    Object.assign(en, { work: 'Checklist', documents: 'Documents', sections: 'Ticket sections', blockedBy: 'Waiting for', expected: 'Expected', actual: 'Actual', recordedAt: 'Recorded at', passed: 'Passed', failed: 'Failed', 'not-run': 'Not run', viewEvidence: 'Review evidence', evidenceText: 'Original evidence text', image: 'Image evidence', openPreview: 'Open preview', playOpen: 'Play / open', previewHint: 'Previewing a file does not pass acceptance. Full files open in the sidebar without a model request.', noEvidence: 'No file references were recognized. Read the original acceptance text.', evidencePartial: 'The evidence read limit was reached; some content is omitted.', missingEvidence: 'The file is missing or unreadable', previewUnavailable: 'Preview is unavailable. Check the sidebar/media plugins; the file path is retained.', previewTooLarge: 'Thumbnail budget exceeded. Open the full preview.', previewUnreadable: 'The image cannot be rendered. Open the file to inspect it.', dialogUnavailable: 'This browser cannot open the dialog. Use the workorders conversation view.' });
    Object.assign(zh, { graph: '工单依赖图', graphNodes: '工单', graphEdges: '依赖', graphHint: '箭头从前置工单指向依赖它的工单；点击节点查看详情。', graphEmpty: '当前任务没有工单。', graphIsolated: '这些工单没有前置依赖。', graphLarge: '工单数量超过整图上限，当前只显示所选工单与直接前后置；可切换为全图。', graphFull: '显示全图', graphCycle: '依赖存在循环，按异常显示', graphMissing: '前置工单不在当前任务中', graphDuplicate: '重复的工单 ID', zoomIn: '放大', zoomOut: '缩小', fit: '适应', locate: '定位当前', collapse: '收起图', expand: '展开图' });
    Object.assign(en, { graph: 'Dependency map', graphNodes: 'Tickets', graphEdges: 'Links', graphHint: 'Arrows point from a prerequisite to the ticket that waits for it. Select a node to read its details.', graphEmpty: 'This task has no tickets.', graphIsolated: 'These tickets have no prerequisites.', graphLarge: 'The full map exceeds the node limit, so only the selected ticket and its direct neighbours are drawn. Switch to the full map.', graphFull: 'Show full map', graphCycle: 'Dependency cycle shown as an anomaly', graphMissing: 'Prerequisite is not in this task', graphDuplicate: 'Duplicate ticket id', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', locate: 'Locate selected', collapse: 'Hide map', expand: 'Show map' });
    Object.assign(zh, { eyebrow: '游戏工单 · 只读', selectTask: '任务', statTickets: '工单', statItems: '工作项', statBlocked: '阻塞', statDoing: '执行中', detail: '所选工单', list: '工单列表', inspect: '工单详情', planTab: '规划', ticketSearch: '筛选工单', noSelection: '在左侧依赖图或右侧列表选择一张工单。', noTickets: '当前筛选没有工单。', viewDoc: '查看工单原文', backToTabs: '返回详情', documentsHint: '工单与职责文档在此处阅读，不离开工作台。', planningHint: '规划只生成文档与工单，不实现代码；执行仍需在工单上确认。', panHint: '右键拖动平移；Ctrl/⌘ + 滚轮缩放；方向键平移。', map: '工单依赖图', legendArrow: '箭头：前置 → 依赖方', graphFullHint: '全图已达硬上限，只绘制放得下的工单。', graphTruncated: '为保持可读，部分工单未绘制。', graphUnreachable: '这些工单的上游存在循环，单独列出。', graphFocus: '当前只显示所选工单的上下游', cachedChip: '缓存', cachedHint: '先显示上次读到的工单，正在后台校验最新状态。', validating: '正在校验最新工单…', scanTasks: '扫描任务',
          motionOn: '开启动效', motionOff: '关闭动效', motionHint: '执行中的工单会让依赖线流动',
          parallelReady: '可并行', parallelHint: '当前有 {n} 项就绪工单可同时领取（前置均已完成）', parallelPeers: '同批可并行',
          layoutOrganic: '展开排布', layoutLayered: '分层排布', layoutHint: '在错落展开与对齐分层之间切换' });
    Object.assign(en, { eyebrow: 'GAME WORKORDERS · READ ONLY', selectTask: 'Task', statTickets: 'Tickets', statItems: 'Checklist', statBlocked: 'Blocked', statDoing: 'Doing', detail: 'Selected ticket', list: 'Tickets', inspect: 'Ticket details', planTab: 'Plan', ticketSearch: 'Filter tickets', noSelection: 'Select a ticket in the map or the list.', noTickets: 'No tickets match this filter.', viewDoc: 'Read ticket', backToTabs: 'Back to details', documentsHint: 'Ticket and responsibility documents open here without leaving the workbench.', planningHint: 'Planning only writes documents and tickets; execution stays a confirmed ticket action.', panHint: 'Right-drag to pan; Ctrl/⌘ + wheel to zoom; arrow keys to pan.', map: 'Dependency map', legendArrow: 'Arrow: prerequisite → dependent', graphFullHint: 'The full map hit its hard ceiling; only tickets that fit are drawn.', graphTruncated: 'Some tickets are omitted to keep the map readable.', graphUnreachable: 'Upstream cycles put these tickets on their own row.', graphFocus: 'Showing only the selected ticket chain', cachedChip: 'Cached', cachedHint: 'Showing the last snapshot while the current state is revalidated.', validating: 'Revalidating the latest tickets…', scanTasks: 'Scan tasks',
          motionOn: 'Enable motion', motionOff: 'Disable motion', motionHint: 'In-flight tickets animate their dependency line',
          parallelReady: 'Parallel', parallelHint: '{n} ready tickets can be claimed at the same time (all prerequisites completed)', parallelPeers: 'Claimable now',
          layoutOrganic: 'Spread layout', layoutLayered: 'Aligned layout', layoutHint: 'Switch between the staggered spread and the aligned grid' });
    const css = /* WORKBENCH_CSS */;

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
        async function command(store, name, args, signal) {
          if (name === 'game-tickets') {
            // Background reads never enter commands.execute or append command history.
            const { action, ...options } = args;
            // $mount provides this namespace in a sibling fiber after activation.
            // Parent `remote` injection does not authorize dotted property access;
            // optional get is required here (a hard dependency would deadlock $mount).
            const queries = ctx.get('remote.gameWorkorders');
            if (!queries) throw new Error(t('queryUnavailable'));
            let response;
            if (action === 'discover') response = await queries.discover(store.sessionId, options, signal);
            else if (action === 'snapshot') response = await queries.snapshot(store.sessionId, options.root, signal);
            else if (action === 'document') response = await queries.document(store.sessionId, options.root, options.file, signal);
            else if (action === 'evidence') response = await queries.evidence(store.sessionId, options.root, options.taskId, signal);
            else if (action === 'resolveEvidence') response = await queries.resolveEvidence(store.sessionId, options.root, options.taskId, options.evidenceId, signal);
            else throw new Error(t('invalid'));
            if (!response.ok) throw new Error(response.error?.message || t('failed'));
            if (!response.value || typeof response.value !== 'object') throw new Error(t('invalid'));
            return { protocol: 'game-workorders/1', action, data: response.value };
          }
          const line = `/${name}${args === undefined ? '' : ` ${JSON.stringify(args)}`}`;
          return decode(await ctx.remote.commands.execute(store.sessionId, line, []));
        }
        // Remembered root must not depend on a discovery scan: the cache-first open
        // happens before any scan, so the old cwd-scoped key would never match.
        function rootKey(store) { return `gwo:root:${store.sessionId}`; }
        function preferenceKey(store) { return `gwo:selected:${store.sessionId}:${store.discovery?.cwd || ''}`; }
        function saved(store) { try { return localStorage.getItem(rootKey(store)) || localStorage.getItem(preferenceKey(store)) || ''; } catch { return ''; } }
        function remember(store, root) { try { localStorage.setItem(rootKey(store), root); localStorage.setItem(preferenceKey(store), root); } catch {} }
        // Local snapshot cache: paint last known tickets immediately, then revalidate.
        // It is display-only; every execution gate still re-reads through the Host.
        const SNAPSHOT_CACHE_KEY = 'dsh-game-workorders/snapshot/v1';
        const SNAPSHOT_CACHE_VERSION = 1;
        const SNAPSHOT_CACHE_ROOTS = 4;
        const SNAPSHOT_CACHE_BYTES = 512 * 1024;
        function cacheEntries() {
          try {
            const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== SNAPSHOT_CACHE_VERSION || typeof parsed.entries !== 'object' || !parsed.entries) return {};
            return parsed.entries;
          } catch { return {}; }
        }
        function cacheWrite(entries) {
          try { localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify({ v: SNAPSHOT_CACHE_VERSION, entries })); }
          catch { try { localStorage.removeItem(SNAPSHOT_CACHE_KEY); } catch {} }
        }
        function cachedSnapshot(root) {
          if (!root) return null;
          const entry = cacheEntries()[root];
          if (!entry || !entry.snapshot || typeof entry.snapshot !== 'object') return null;
          if (entry.schemaVersion !== undefined && entry.schemaVersion !== 1) return null;
          return entry;
        }
        function rememberSnapshot(root, snapshot) {
          if (!root || !snapshot || typeof snapshot !== 'object') return;
          let size = 0;
          try { size = JSON.stringify(snapshot).length; } catch { return; }
          if (size > SNAPSHOT_CACHE_BYTES) return;
          const entries = cacheEntries();
          entries[root] = { at: Date.now(), schemaVersion: 1, snapshot };
          const keys = Object.keys(entries);
          keys.sort((left, right) => (entries[right].at - entries[left].at) || (keys.indexOf(right) - keys.indexOf(left)));
          keys.slice(SNAPSHOT_CACHE_ROOTS).forEach(stale => { delete entries[stale]; });
          cacheWrite(entries);
        }
        function forgetSnapshot(root) { const entries = cacheEntries(); if (!root || !entries[root]) return; delete entries[root]; cacheWrite(entries); }
        /** Paint the cached snapshot for the remembered root; returns the root to revalidate. */
        function hydrateSnapshot(store) {
          const root = store.root || saved(store);
          if (!root) return '';
          const entry = cachedSnapshot(root);
          if (entry) update(store, { root, snapshot: entry.snapshot, cachedAt: entry.at, stale: true, doc: null, confirmation: null });
          else if (!store.root) update(store, { root });
          return root;
        }
        async function select(store, root) {
          const token = ++store.request;
          const changed = store.root !== root;
          if (changed) ++store.docRequest;
          update(store, { root, loading: store.loading + 1, error: '', ...(changed ? { snapshot: null, doc: null, confirmation: null, stale: false, cachedAt: null } : {}) });
          try {
            const payload = await command(store, 'game-tickets', { action: 'snapshot', root });
            if (token !== store.request || root !== store.root) return;
            remember(store, root);
            rememberSnapshot(root, payload.data);
            update(store, { snapshot: payload.data, stale: false, cachedAt: null });
          } catch (error) { if (token === store.request) update(store, { error: `${t('snapshotError')} ${error.message}` }); }
          finally { update(store, { loading: Math.max(0, store.loading - 1) }); }
        }
        function clearSelection(store) {
          ++store.request;
          ++store.docRequest;
          update(store, { root: '', snapshot: null, doc: null, confirmation: null, stale: false, cachedAt: null });
        }
        function adoptSnapshot(store, snapshot) {
          ++store.request;
          ++store.docRequest;
          update(store, { root: snapshot.root, snapshot, doc: null, confirmation: null, error: '', stale: false, cachedAt: null });
          remember(store, snapshot.root);
          rememberSnapshot(snapshot.root, snapshot);
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
          // A cached snapshot is display-only; never let it authorize an execution.
          if (action === 'execute' && store.stale) { update(store, { error: t('validating'), confirmation: null }); return; }
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
        const disposedResources = [];
        const { App, Dock } = createWorkbench({ React, ctx, t, style, useStore, update, discover, select, command, readDocument, closeDocument, start, button, line, disposedResources, createThumbnailPool, hydrateSnapshot });
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
          return h('div', null, eligible && h('div', { className: 'gwo gwo-panel gwo-candidates', 'data-we-surface-preserve': '' }, style(), h('strong', null, t('choose')), store.loading > 0 && h('div', null, t('loading')), ...candidates.map(task => button(`${task.name} · ${task.project}`, () => complete(task), { key: task.root }))), h(Dock, { sessionId: props.sessionId }));
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
        ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'game-system-workorders', order: 35, label: () => t('title') }, props => h(App, { key: props.sessionId, sessionId: props.sessionId, full: true })));
        ctx.slots.inject('conversation.chat.commandview', () => {
          const disposers = ['game-tickets', 'game-execute', 'game-plan'].map(key => ctx.slots.register({ name: 'conversation.chat.commandview', key }, CommandCard));
          return () => disposers.forEach(dispose => dispose());
        });
        ctx.effect(() => () => { disposed = true; disposedResources.forEach(dispose => dispose()); stores.forEach(store => store.listeners.clear()); stores.clear(); });
      },
    };
  },
});
