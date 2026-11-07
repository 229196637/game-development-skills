export function createWorkbench({ React, ctx, t, style, useStore, update, discover, select, command, readDocument, closeDocument, start, button, line, disposedResources, createThumbnailPool, hydrateSnapshot }) {
  const h = React.createElement;
  const checked = item => item[0] === 'x' || item[0] === 'X' || item[0] === true;
  const pool = createThumbnailPool();
  disposedResources.push(() => pool.dispose());
  function useSurface(ref) {
    React.useEffect(() => {
      const element = ref.current;
      if (!element || globalThis.CSS?.supports?.('color', 'rgb(from red r g b / 1)')) return;
      const apply = () => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--dsw-alias-bg-layer-1)'; probe.hidden = true; element.appendChild(probe);
        const value = getComputedStyle(probe).color; probe.remove();
        const match = /^rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/.exec(value);
        if (match) element.style.setProperty('--gwo-surface', `rgb(${match[1]} ${match[2]} ${match[3]})`);
      };
      apply(); const off = ctx.on('theme/change', apply); return () => off?.();
    }, []);
  }
  async function openEvidence(store, taskId, item, signal) {
    const root = store.root, token = (store.previewRequest || 0) + 1;
    store.previewRequest = token;
    const current = () => !signal.aborted && store.root === root && store.previewRequest === token;
    try {
      const { data } = await command(store, 'game-tickets', { action: 'resolveEvidence', root, taskId, evidenceId: item.id }, signal);
      if (!current()) return;
      if (data.exists === false || data.reason) throw new Error(data.reason || t('missingEvidence'));
      const sidebar = ctx.get('sidebarRight');
      if (sidebar && data.address && sidebar.mounted?.getSnapshot?.() === store.sessionId) {
        update(store, { open: false });
        sidebar.openResource(data.address);
      } else {
        const better = ctx.get('betterSidebar');
        if (!better?.features?.includes('openFile') || !better.features.includes('targetedOpen')) throw new Error(t('previewUnavailable'));
        update(store, { open: false });
        better.openFile({ sessionId: store.sessionId }, data.path, data.label);
      }
    } catch (error) { if (current()) update(store, { error: error.message, open: true }); }
  }
  function Thumbnail({ store, task, item }) {
    const ref = React.useRef(null);
    const [state, setState] = React.useState({});
    React.useEffect(() => {
      const controller = new AbortController(); let resource;
      const root = store.root; let observer, started = false;
      const load = async () => {
        if (started || controller.signal.aborted) return; started = true;
        try {
          const result = await pool.load(item.size, async signal => {
            const { data } = await command(store, 'game-tickets', { action: 'resolveEvidence', root, taskId: task.id, evidenceId: item.id }, signal);
            if (root !== store.root || data.exists === false || data.reason) throw new Error(t('missingEvidence'));
            const files = ctx.get('remote.workspaceFiles');
            if (!files) throw new Error(t('previewUnavailable'));
            if (!(data.size > 0) || data.size > 5 * 1024 * 1024) throw new Error('previewTooLarge');
            const response = await files.readBytes(store.sessionId, data.path, { range: { offset: 0, length: 5 * 1024 * 1024 + 1 } }, signal);
            if (!response.ok) throw new Error(response.error?.message || t('failed'));
            const bytes = response.value?.data;
            if (!(bytes instanceof Uint8Array)) throw new Error(t('invalid'));
            if (!response.value.eof || bytes.byteLength > 5 * 1024 * 1024) throw new Error('previewTooLarge');
            return new Blob([bytes], { type: ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' })[data.path.split('.').pop().toLowerCase()] || 'application/octet-stream' });
          }, controller.signal);
          resource = result;
          if (!controller.signal.aborted && root === store.root) setState({ url: result.url }); else result.release();
        } catch (error) { if (!controller.signal.aborted) setState({ error: t(error.message) || error.message }); }
      };
      if (typeof IntersectionObserver !== 'undefined') { observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); load(); } }); if (ref.current) observer.observe(ref.current); }
      else load();
      return () => { controller.abort(); observer?.disconnect(); resource?.release(); };
    }, [store, store.root, task.id, item.id, item.size, item.path]);
    return h('div', { ref }, state.url ? h('img', { src: state.url, alt: item.label || t('evidence'), loading: 'lazy', onError: () => setState({ error: t('previewUnreadable') }) }) : h('div', { className: 'gwo-media-icon', 'aria-label': t('image') }, '▧'), state.error && h('small', { className: 'gwo-muted' }, state.error));
  }
  function Evidence({ store, task }) {
    const [state, setState] = React.useState({ loading: true });
    const life = React.useRef(null);
    React.useEffect(() => { const controller = new AbortController(); life.current = controller; return () => { controller.abort(); if (life.current === controller) life.current = null; }; }, []);
    React.useEffect(() => {
      const controller = new AbortController(); const root = store.root;
      setState({ loading: true });
      command(store, 'game-tickets', { action: 'evidence', root, taskId: task.id }, controller.signal)
        .then(({ data }) => { if (!controller.signal.aborted && store.root === root) setState({ data }); })
        .catch(error => { if (!controller.signal.aborted) setState({ error: error.message }); });
      return () => controller.abort();
    }, [store, store.root, task.id, task.updated]);
    if (state.loading) return h('p', { role: 'status' }, t('loading'));
    if (state.error) return h('p', { role: 'alert', className: 'gwo-note gwo-error' }, state.error);
    return h(React.Fragment, null,
      h('p', { className: 'gwo-muted' }, t('previewHint')),
      state.data?.partial && h('p', { className: 'gwo-note gwo-warn' }, t('evidencePartial')),
      ...(state.data?.issues || []).map((issue, i) => h('p', { key: i, className: 'gwo-muted' }, typeof issue === 'string' ? issue : issue.message || issue.error || JSON.stringify(issue))),
      !(state.data?.items || []).length && h('p', { className: 'gwo-muted' }, t('noEvidence')),
      h('div', { className: 'gwo-evidence-grid' }, ...(state.data?.items || []).map(item => h('article', { key: item.id, className: 'gwo-evidence-card' },
        item.kind === 'image' && item.exists && !item.reason ? h(Thumbnail, { store, task, item }) : h('div', { className: 'gwo-media-icon', 'aria-label': item.kind }, item.kind === 'video' ? '▷' : item.kind === 'audio' ? '♪' : '▤'),
        h('strong', null, item.label || item.path?.split(/[\\/]/).pop()), h('small', { className: 'gwo-path' }, item.sourceField),
        h('span', { className: 'gwo-path', title: item.path }, item.path),
        item.reason && h('p', { className: 'gwo-muted' }, item.reason),
        // The click owns this mount's lifetime: closing the dialog or switching tickets aborts
        // the pending resolve so an old ticket cannot navigate the sidebar after the fact.
        button(['video', 'audio'].includes(item.kind) ? t('playOpen') : t('openPreview'), () => { const signal = life.current?.signal; if (signal && !signal.aborted) openEvidence(store, task.id, item, signal); }, { disabled: item.exists === false || !!item.reason })))));
  }
  const { MapView } = createGraphView({ React, t, button, lib: { buildGraph, countGraph, focusSet, linkedIds, edgePath } });
  function Result({ item, acceptance }) {
    return h('article', { className: 'gwo-result' }, h('div', { className: 'gwo-bar' }, h('strong', null, item.id), h('span', { className: 'gwo-state', 'data-state': item.result }, t(item.result))),
      item.expected && line(t('expected'), item.expected), line(t('actual'), item.actual), item.time && line(t('recordedAt'), item.time),
      !acceptance && item.command && h('details', null, h('summary', null, t('command')), h('code', { className: 'gwo-path' }, item.command)),
      acceptance && item.evidence && h('details', null, h('summary', null, t('evidenceText')), h('p', { className: 'gwo-path' }, item.evidence)),
      !acceptance && item.report && h('span', { className: 'gwo-path' }, item.report, item.reportExists === false ? ` · ${t('missingEvidence')}` : ''));
  }
  function kv(label, value) {
    return h('div', { className: 'gwo-kv-row' }, h('span', { className: 'gwo-kv-label' }, label), h('span', { className: 'gwo-kv-value', title: typeof value === 'string' ? value : undefined }, value));
  }
  // Right column, top card: everything you need to decide what to do with the selected ticket.
  function Detail({ store, task, snapshot, onSelect }) {
    const items = task?.items || [], done = items.filter(checked).length;
    const blocked = task?.blocked_by || [];
    const readyIds = new Set(snapshot?.ready || []);
    const peers = task ? (snapshot?.tasks || []).filter(other => other.id !== task.id && readyIds.has(other.id)) : [];
    return h('section', { className: 'gwo-panel gwo-detail', 'aria-label': t('detail') },
      h('div', { className: 'gwo-panel-head' }, h('strong', { className: 'gwo-panel-title' }, t('detail')), task && h('span', { className: 'gwo-state', 'data-state': task.status }, t(task.status))),
      !task ? h('p', { className: 'gwo-muted gwo-detail-empty' }, t('noSelection'))
        : h('div', { className: 'gwo-detail-body' },
          h('h3', { className: 'gwo-detail-title', title: task.id }, task.class || task.id),
          h('div', { className: 'gwo-kv' },
            kv(t('owner'), task.claim || t('none')),
            kv(t('depends'), (task.depends_on || []).join(', ') || t('none')),
            blocked.length > 0 && kv(t('blockedBy'), blocked.join(', ')),
            peers.length > 0 && h('div', { className: 'gwo-kv-row' },
              h('span', { className: 'gwo-kv-label' }, t('parallelPeers')),
              h('span', { className: 'gwo-kv-value' }, peers.slice(0, 4).map(peer => h('button', { type: 'button', key: peer.id, className: 'gwo-chip', title: peer.id, onClick: () => onSelect?.(peer.id) }, peer.class || peer.id)),
                peers.length > 4 && ` +${peers.length - 4}`)),
            kv(t('items'), `${done}/${items.length}`)),
          h('progress', { max: Math.max(1, items.length), value: done, 'aria-label': t('items') }),
          h('div', { className: 'gwo-detail-actions' },
            button(t('execute'), () => update(store, { confirmation: { action: 'execute', value: store.root } }), { disabled: store.pending || store.loading > 0 || store.stale || snapshot?.consistency?.stable === false, title: store.stale ? t('validating') : undefined }),
            button(t('viewDoc'), () => readDocument(store, task.file)),
            task.document && button(t('responsibility'), () => readDocument(store, task.document)))));
  }
  // Right column, bottom card: filter chips plus a scrolling ticket list.
  function TicketList({ tickets, selectedId, onSelect, filter, onFilter, counts, query, onQuery }) {
    const states = ['todo', 'doing', 'blocked', 'completed'];
    return h('section', { className: 'gwo-panel gwo-list', 'aria-label': t('list') },
      h('div', { className: 'gwo-panel-head' }, h('strong', { className: 'gwo-panel-title' }, t('list')), h('span', { className: 'gwo-muted' }, `${tickets.length}/${counts?.total || 0}`)),
      h('div', { className: 'gwo-chips', role: 'group', 'aria-label': t('filter') },
        h('button', { type: 'button', className: 'gwo-chip', 'aria-pressed': !filter, onClick: () => onFilter('') }, `${t('statusAll')} ${counts?.total || 0}`),
        ...states.map(state => h('button', { type: 'button', key: state, className: 'gwo-chip', 'aria-pressed': filter === state, 'data-state': state, onClick: () => onFilter(filter === state ? '' : state) }, `${t(state)} ${counts?.[state] || 0}`))),
      h('input', { className: 'gwo-search', 'aria-label': t('ticketSearch'), placeholder: t('ticketSearch'), value: query, onChange: event => onQuery(event.target.value) }),
      h('div', { className: 'gwo-list-rows', role: 'listbox', 'aria-label': t('list') },
        !tickets.length && h('p', { className: 'gwo-muted' }, t('noTickets')),
        ...tickets.map(task => h('button', {
          type: 'button', key: task.id, role: 'option', className: 'gwo-list-row',
          'aria-selected': task.id === selectedId ? 'true' : 'false', 'data-state': task.status, onClick: () => onSelect(task.id),
        },
        h('span', { className: 'gwo-list-row-main' }, h('strong', null, task.class || task.id), h('span', { className: 'gwo-state', 'data-state': task.status }, t(task.status))),
        h('span', { className: 'gwo-list-row-sub' }, `${(task.items || []).filter(checked).length}/${(task.items || []).length} · ${task.claim || t('none')}`)))));
  }
  // Bottom band: ticket details keep their own scroll so the map never competes for height.
  function Inspect({ store, task, requirement, setRequirement, onPlan, planPending }) {
    const scope = `${store.root}:${task?.id || ''}`;
    const [tab, set] = React.useState(store.viewState?.tabs?.[scope] || 'work');
    const setTab = value => { store.viewState = { ...store.viewState, tabs: { ...store.viewState?.tabs, [scope]: value } }; set(value); };
    const tabs = ['work', 'tests', 'acceptance', 'evidence', 'documents', 'plan'];
    const items = task?.items || [], done = items.filter(checked).length;
    const doc = store.doc;
    const body = doc ? h('div', { className: 'gwo-doc-wrap' },
      h('div', { className: 'gwo-bar' }, button(t('backToTabs'), () => closeDocument(store)), h('small', { className: 'gwo-path' }, doc.file)),
      h('pre', { className: 'gwo-doc' }, doc.content))
      : !task ? h('p', { className: 'gwo-muted' }, t('noSelection'))
        : tab === 'work' ? h('section', null,
          h('div', { className: 'gwo-bar' }, h('strong', null, `${done} / ${items.length}`), h('span', { className: 'gwo-muted' }, t('checked'))),
          h('progress', { max: Math.max(1, items.length), value: done, 'aria-label': t('items') }),
          h('ul', { className: 'gwo-checks' }, ...items.map((item, index) => h('li', { key: index, 'data-checked': checked(item) }, h('span', { 'aria-label': checked(item) ? t('checked') : t('todo') }, checked(item) ? '☑' : '☐'), h('span', null, item[1])))))
          : tab === 'tests' ? h('section', null, !(task.latest_tests || []).length && h('p', null, t('notVerified')), ...(task.latest_tests || []).map((item, index) => h(Result, { key: index, item })))
            : tab === 'acceptance' ? h('section', null, !(task.latest_acceptance || []).length && h('p', null, t('notVerified')), ...(task.latest_acceptance || []).map((item, index) => h(Result, { key: index, item, acceptance: true })), button(t('viewEvidence'), () => setTab('evidence')))
              : tab === 'evidence' ? h(Evidence, { key: scope, store, task })
                : tab === 'documents' ? h('div', { className: 'gwo-docs' },
                  h('div', { className: 'gwo-bar' }, button(t('ticket'), () => readDocument(store, task.file)), task.document && button(t('responsibility'), () => readDocument(store, task.document))),
                  h('p', { className: 'gwo-muted' }, t('documentsHint')))
                  : h('section', { className: 'gwo-plan-panel' },
                    h('p', { className: 'gwo-muted' }, t('planningHint')),
                    h('textarea', { 'aria-label': t('requirement'), placeholder: t('requirement'), value: requirement, onChange: event => setRequirement(event.target.value) }),
                    h('div', { className: 'gwo-bar' }, button(t('plan'), onPlan, { disabled: planPending })));
    return h('section', { className: 'gwo-panel gwo-inspect', 'aria-label': t('inspect') },
      h('div', { className: 'gwo-panel-head gwo-inspect-head' },
        h('strong', { className: 'gwo-panel-title' }, t('inspect')),
        h('nav', { className: 'gwo-tabs', 'aria-label': t('sections') }, ...tabs.map(id => button(id === 'plan' ? t('planTab') : t(id), () => setTab(id), { key: id, 'aria-pressed': !doc && tab === id, disabled: !task && id !== 'plan' })))),
      h('div', { className: 'gwo-inspect-body' }, body));
  }
  function App({ sessionId, full = false }) {
    const store = useStore(sessionId); const ref = React.useRef(null); useSurface(ref);
    function field(name, initial) { const [value, set] = React.useState(store.viewState?.[name] ?? initial); return [value, next => { store.viewState = { ...store.viewState, [name]: next }; set(next); }]; }
    const [query, setQuery] = field('query', ''), [directory, setDirectory] = field('directory', ''), [all, setAll] = field('all', false), [auto, setAuto] = field('auto', true), [filter, setFilter] = field('filter', ''), [ticketId, setTicketId] = field('ticketId', ''), [requirement, setRequirement] = field('requirement', ''), [ticketQuery, setTicketQuery] = field('ticketQuery', '');
    React.useEffect(() => {
      if (store.loading > 0) return;
      // Reopening must not rescan the whole tree: a remembered root paints from cache first.
      const root = store.root || hydrateSnapshot(store);
      if (root) { select(store, root); return; }
      if (!store.discovery) discover(store);
    }, [store]);
    React.useEffect(() => {
      if (!auto || !store.root) return;
      const timer = setInterval(() => { if (document.visibilityState !== 'visible' || store.loading || Date.now() - (store.lastPoll || 0) < 14000) return; store.lastPoll = Date.now(); select(store, store.root); }, 15000);
      return () => clearInterval(timer);
    }, [store, store.root, auto]);
    const snapshot = store.snapshot;
    const tasks = (store.discovery?.tasks || []).filter(task => `${task.name} ${task.project}`.toLowerCase().includes(query.toLowerCase()));
    const allTickets = snapshot?.tasks || [];
    const needle = ticketQuery.trim().toLowerCase();
    const tickets = allTickets.filter(task => (!filter || task.status === filter) && (!needle || `${task.class || ''} ${task.id}`.toLowerCase().includes(needle)));
    const selected = tickets.find(task => task.id === ticketId) || tickets[0];
    function chooseTicket(id) {
      // Selecting a node must reveal its details even when the status filter hides it.
      const task = allTickets.find(candidate => candidate.id === id);
      if (task && filter && task.status !== filter) setFilter('');
      if (needle && task && !`${task.class || ''} ${task.id}`.toLowerCase().includes(needle)) setTicketQuery('');
      setTicketId(id);
    }
    const counts = snapshot?.counts || {}, progress = snapshot?.progress || {};
    const plan = () => requirement.trim() ? update(store, { confirmation: { action: 'plan', value: requirement.trim() } }) : update(store, { error: t('noRequirement') });
    const title = store.root ? store.root.split(/[\\/]/).pop() : t('title');
    return h('section', { ref, className: `gwo gwo-workbench${full ? ' gwo-full' : ''}`, 'data-we-surface-preserve': '', 'aria-label': t('title') }, style(),
      h('header', { className: 'gwo-head' },
        h('div', { className: 'gwo-head-main' },
          h('div', { className: 'gwo-eyebrow-row' }, h('span', { className: 'gwo-eyebrow' }, t('eyebrow')), h('span', { className: 'gwo-chip' }, t('readOnly')),
            store.stale && h('span', { className: 'gwo-chip gwo-chip-cached', title: t('cachedHint') }, store.cachedAt ? `${t('cachedChip')} · ${new Date(store.cachedAt).toLocaleTimeString()}` : t('cachedChip'))),
          h('div', { className: 'gwo-title-row' },
            h('h1', { className: 'gwo-title' }, title),
            h('div', { className: 'gwo-title-actions' },
              button(t('refresh'), () => store.root ? select(store, store.root) : discover(store, { directory, includeCompleted: all }), { disabled: store.loading > 0 }),
              !full && button(t('close'), () => update(store, { open: false })))),
          h('p', { className: 'gwo-subtitle gwo-path', title: store.root }, store.root || t('queryHint')),
          h('div', { className: 'gwo-head-tools' },
            h('label', { className: 'gwo-field' }, h('span', null, t('selectTask')),
              h('select', { 'aria-label': t('selectTask'), value: store.root || '', onChange: event => { if (event.target.value) select(store, event.target.value); } },
                !tasks.length && store.root && h('option', { value: store.root }, store.root.split(/[\\/]/).pop()),
                !tasks.length && !store.root && h('option', { value: '' }, t('empty')),
                ...tasks.map(item => h('option', { key: item.root, value: item.root }, `${item.name} · ${item.counts.completed}/${item.counts.total}`)))),
            !store.discovery && button(t('scanTasks'), () => discover(store, { directory, includeCompleted: all }), { disabled: store.loading > 0 }),
            h('input', { className: 'gwo-search', 'aria-label': t('search'), placeholder: t('search'), value: query, onChange: event => setQuery(event.target.value) }),
            h('details', { className: 'gwo-rescan' }, h('summary', null, t('rescan')),
              h('input', { 'aria-label': t('scan'), placeholder: t('scan'), value: directory, onChange: event => setDirectory(event.target.value) }),
              h('label', { className: 'gwo-label' }, h('input', { type: 'checkbox', checked: all, onChange: event => { setAll(event.target.checked); discover(store, { directory, includeCompleted: event.target.checked }); } }), t('all')),
              button(t('rescan'), () => discover(store, { directory, includeCompleted: all }), { disabled: store.loading > 0 })),
            h('label', { className: 'gwo-label', title: t('autoHint') }, h('input', { type: 'checkbox', checked: auto, onChange: event => setAuto(event.target.checked) }), t('auto')))),
        h('div', { className: 'gwo-stats' },
          h('div', { className: 'gwo-pill' }, h('span', null, t('statTickets')), h('strong', null, `${counts.completed || 0}/${counts.total || 0}`), h('progress', { max: 100, value: progress.percent || 0, 'aria-label': t('statTickets') })),
          h('div', { className: 'gwo-pill' }, h('span', null, t('statItems')), h('strong', null, `${progress.itemsChecked || 0}/${progress.itemsTotal || 0}`)),
          h('div', { className: 'gwo-pill', 'data-state': 'blocked' }, h('span', null, t('statBlocked')), h('strong', null, String(counts.blocked || 0))),
          h('div', { className: 'gwo-pill', 'data-state': 'doing' }, h('span', null, t('statDoing')), h('strong', null, String(counts.doing || 0))))),
      h('div', { className: 'gwo-main' },
        h(MapView, { key: store.root || 'none', store, tasks: allTickets, selectedId: selected?.id, onSelect: chooseTicket, snapshot }),
        h('aside', { className: 'gwo-side' },
          h(Detail, { store, task: selected, snapshot, onSelect: chooseTicket }),
          h(TicketList, { tickets, selectedId: selected?.id, onSelect: setTicketId, filter, onFilter: setFilter, counts, query: ticketQuery, onQuery: setTicketQuery }))),
      h(Inspect, { key: `${store.root}:${selected?.id || ''}`, store, task: selected, requirement, setRequirement, onPlan: plan, planPending: store.pending }),
      h('footer', { className: 'gwo-foot' },
        h('div', { className: 'gwo-foot-notes' },
          store.error && h('span', { className: 'gwo-foot-note gwo-error', role: 'alert' }, store.error),
          store.status && h('span', { className: 'gwo-foot-note', role: 'status' }, store.status),
          store.loading > 0 && h('span', { className: 'gwo-muted', role: 'status' }, t('loading')),
          store.stale && h('span', { className: 'gwo-foot-note gwo-warn', role: 'status' }, t('validating')),
          snapshot?.consistency?.stable === false && h('span', { className: 'gwo-foot-note gwo-warn' }, t('updating')),
          store.discovery?.partial && h('span', { className: 'gwo-foot-note gwo-warn' }, t('partial')),
          snapshot?.next?.id && h('span', { className: 'gwo-muted' }, `${t('next')}: ${snapshot.next.id}`),
          snapshot && h('span', { className: 'gwo-muted' }, `${t('readAt')}: ${snapshot.readAt || snapshot.updated || ''}`),
          (store.discovery?.issues || []).length > 0 && h('details', { className: 'gwo-foot-note gwo-warn' }, h('summary', null, t('issues')), ...store.discovery.issues.map((issue, index) => h('p', { key: index, className: 'gwo-path' }, `${issue.path}: ${issue.error}`)))),
        store.confirmation && h('div', { className: 'gwo-confirm' },
          h('strong', null, store.confirmation.action === 'execute' ? t('confirmHint') : t('planning')),
          h('span', { className: 'gwo-path', title: store.confirmation.value }, store.confirmation.value),
          button(store.confirmation.action === 'execute' ? t('confirm') : t('planConfirm'), () => start(store, store.confirmation.action, store.confirmation.value), { disabled: store.pending }),
          button(t('cancel'), () => update(store, { confirmation: null }), { disabled: store.pending }))));
  }
  function seat(sessionId) { return seatOf(sessionId, ctx.get('sidebarRight')?.mounted, ctx.get('betterSidebar')); }
  function Dock({ sessionId }) {
    const store = useStore(sessionId), ref = React.useRef(null); useSurface(ref);
    React.useEffect(() => {
      const dialog = ref.current;
      if (!dialog || !store.open) return;
      const previous = document.activeElement;
      if (seat(sessionId) === 'other') { update(store, { open: false }); return; }
      if (typeof dialog.showModal !== 'function') { update(store, { open: false, error: t('dialogUnavailable') }); return; }
      if (!dialog.open) dialog.showModal();
      const mounted = ctx.get('sidebarRight')?.mounted, sidebar = ctx.get('betterSidebar');
      // A background session's delayed command can open this store while another seat is drawn:
      // reconcile once on subscribe, then close as soon as the drawn seat stops being ours.
      const reconcile = () => { if (seat(sessionId) === 'other') update(store, { open: false }); };
      const off = mounted?.subscribe ? mounted.subscribe(reconcile)
        : sidebar?.features?.includes('stateSubscription') ? sidebar.subscribeState(reconcile) : undefined;
      reconcile();
      return () => { off?.(); if (dialog.open) dialog.close(); if (previous?.isConnected) previous.focus(); };
    }, [store, store.open]);
    return h(React.Fragment, null, h('div', { className: 'gwo gwo-bar gwo-dock' }, style(), button(t('open'), () => update(store, { open: true })), h('small', { className: 'gwo-muted' }, store.root ? store.root.split(/[\\/]/).pop() : t('queryHint'))),
      h('dialog', { ref, className: 'gwo gwo-dialog', 'aria-label': t('title'), 'aria-modal': 'true', 'data-we-surface-preserve': '', onCancel: e => { e.preventDefault(); update(store, { open: false }); }, onClose: () => { if (store.open) update(store, { open: false }); } }, store.open && h(App, { key: sessionId, sessionId })));
  }
  return { App, Dock };
}
