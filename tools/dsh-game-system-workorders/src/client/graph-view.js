// Pannable dependency canvas. Pure view math first, then the React component.
// No ctx, no private DSH imports: the caller passes React, `t` and `button`.
export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 2.5;
export const MIN_FIT = 0.02;
export const PAN_STEP = 48;
export const FIT_PAD = 24;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function fitView({ width, height, viewportWidth, viewportHeight, pad = FIT_PAD, min = MIN_FIT, max = 1 }) {
  const safeWidth = Math.max(1, width || 1), safeHeight = Math.max(1, height || 1);
  const availableWidth = Math.max(1, (viewportWidth || 0) - pad * 2);
  const availableHeight = Math.max(1, (viewportHeight || 0) - pad * 2);
  // 1:1 is a ceiling for "fit": a small graph must not be blown up.
  const zoom = clamp(Math.min(availableWidth / safeWidth, availableHeight / safeHeight, max), min, max);
  return { zoom, pan: { x: (viewportWidth - safeWidth * zoom) / 2, y: (viewportHeight - safeHeight * zoom) / 2 } };
}

export function zoomAt(view, factor, cursor) {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return { zoom, pan: { x: cursor.x - (cursor.x - view.pan.x) * ratio, y: cursor.y - (cursor.y - view.pan.y) * ratio } };
}

export function panBy(view, dx, dy) {
  return { zoom: view.zoom, pan: { x: view.pan.x + dx, y: view.pan.y + dy } };
}

export function centerNode(view, node, viewport, nodeWidth, nodeHeight) {
  return {
    zoom: view.zoom,
    pan: {
      x: (viewport.width || 0) / 2 - (node.x + nodeWidth / 2) * view.zoom,
      y: (viewport.height || 0) / 2 - (node.y + nodeHeight / 2) * view.zoom,
    },
  };
}

// Nearest node in one direction, used by the roving-tabindex arrow keys.
export function nearestNeighbor(nodes, from, direction, nodeWidth = 208, nodeHeight = 64) {
  const origin = nodes.find(node => node.id === from);
  if (!origin) return null;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  let best = null;
  for (const node of nodes) {
    if (node.id === origin.id) continue;
    const ax = node.x - origin.x, ay = node.y - origin.y;
    if (dx && Math.sign(ax) !== dx) continue;
    if (dy && Math.sign(ay) !== dy) continue;
    const forward = dx ? Math.abs(ax) : Math.abs(ay);
    const sideways = dx ? Math.abs(ay) : Math.abs(ax);
    if (forward === 0 && sideways === 0) continue;
    const score = forward + sideways * 2;
    if (!best || score < best.score || (score === best.score && node.id < best.node.id)) best = { node, score };
  }
  void nodeWidth; void nodeHeight;
  return best ? best.node.id : null;
}

/**
 * Ticket ids that just moved into an in-flight or finished state. Kept pure so the burst
 * decoration can be tested without a DOM or a React runtime.
 */
export function progressedTargets(previous, next) {
  const moved = new Set();
  if (!previous || !next) return moved;
  for (const [id, status] of next) {
    const before = previous.get(id);
    if (before && before !== status && (status === 'doing' || status === 'completed')) moved.add(id);
  }
  return moved;
}

export function createGraphView({ React, t, button, lib = {} }) {
  const h = React.createElement;
  // Injected rather than imported so the build can inline this module verbatim.
  const { buildGraph, countGraph, focusSet, linkedIds, edgePath } = lib;

  function Legend() {
    return h('div', { className: 'gwo-legend' },
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-state': 'todo' }), t('todo')),
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-state': 'doing' }), t('doing')),
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-state': 'blocked' }), t('blocked')),
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-state': 'completed' }), t('completed')),
      h('span', { className: 'gwo-legend-item gwo-legend-arrow' }, '→', t('legendArrow')),
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-ready': '' }), t('ready')),
      h('span', { className: 'gwo-legend-item' }, h('i', { className: 'gwo-swatch', 'data-next': '' }), t('next')));
  }

  let mapSequence = 0;

  function MapView({ store, tasks, selectedId, onSelect, snapshot }) {
    const root = store.root;
    const saved = store.viewState?.graphs?.[root] || {};
    const [open, setOpen] = React.useState(saved.open !== false);
    const [view, setView] = React.useState(saved.view && typeof saved.view.zoom === 'number' ? saved.view : null);
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const [showAll, setShowAll] = React.useState(false);
    const [panning, setPanning] = React.useState(false);
    const [motion, setMotion] = React.useState(saved.motion !== false);
    const [layout, setLayout] = React.useState(saved.layout === 'layered' ? 'layered' : 'organic');
    const [recentEdges, setRecentEdges] = React.useState(null);
    const previousStatus = React.useRef(null);
    const recentTimer = React.useRef(null);
    const viewport = React.useRef(null);
    const uid = React.useRef(null);
    if (!uid.current) uid.current = `gwo-map-${++mapSequence}`;
    const section = React.useRef(null);
    const dragging = React.useRef(null);
    const nodeRefs = React.useRef(new Map());
    const nodeWidth = 208, nodeHeight = 64;

    function persist(patch) {
      const current = store.viewState?.graphs?.[root] || {};
      store.viewState = { ...store.viewState, graphs: { ...store.viewState?.graphs, [root]: { ...current, ...patch } } };
    }
    function apply(next, extra) { setView(next); persist({ view: next, ...extra }); }

    const counts = countGraph(tasks);
    const limits = { nodes: 500, edges: 2000 };
    const oversized = counts.ids > limits.nodes || counts.edges > limits.edges;
    const focusId = selectedId || tasks?.[0]?.id || '';
    // A huge snapshot never reaches the full layout: it opens on the focused
    // neighbourhood, and "show all" stays inside a hard ceiling.
    const mode = oversized && !showAll ? 'focus' : 'all';
    const include = open && mode === 'focus' ? focusSet(tasks, focusId, limits.nodes) : null;
    const graph = open ? buildGraph(tasks, {
      layout,
      include,
      focus: focusId,
      ready: snapshot?.ready,
      next: snapshot?.next,
      maxNodes: mode === 'all' ? 2000 : limits.nodes,
      maxEdges: mode === 'all' ? 8000 : limits.edges,
    }) : null;
    const fitted = graph && size.width > 0 ? fitView({ width: graph.width, height: graph.height, viewportWidth: size.width, viewportHeight: size.height }) : { zoom: 1, pan: { x: FIT_PAD, y: FIT_PAD } };
    const current = view || fitted;
    const scale = current.zoom;

    React.useEffect(() => {
      const element = viewport.current;
      if (!element) return;
      const measure = () => setSize({ width: element.clientWidth || 0, height: element.clientHeight || 0 });
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }, [open]);
    React.useEffect(() => {
      const element = viewport.current;
      if (!element || typeof element.addEventListener !== 'function') return;
      // React's wheel listener can be passive, which forbids preventDefault; bind natively.
      const onWheel = event => {
        event.preventDefault();
        const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0 };
        const base = view || fitted;
        if (event.ctrlKey || event.metaKey) {
          apply(zoomAt(base, Math.exp(-event.deltaY * 0.0015), { x: event.clientX - rect.left, y: event.clientY - rect.top }));
        } else {
          apply(panBy(base, -event.deltaX, -event.deltaY));
        }
      };
      element.addEventListener('wheel', onWheel, { passive: false });
      return () => element.removeEventListener('wheel', onWheel);
    }, [view, fitted.zoom, fitted.pan.x, fitted.pan.y, scale]);

    // Flag the edges whose target just moved, so progress briefly lights up the arrow.
    React.useEffect(() => {
      const next = new Map();
      for (const task of tasks || []) if (task && task.id) next.set(task.id, task.status || 'todo');
      const previous = previousStatus.current;
      previousStatus.current = next;
      if (!previous) return;
      const moved = progressedTargets(previous, next);
      if (!moved.size) return;
      setRecentEdges(new Set([...moved].map(id => `*:${id}`)));
      if (recentTimer.current) clearTimeout(recentTimer.current);
      recentTimer.current = setTimeout(() => { recentTimer.current = null; setRecentEdges(null); }, 1600);
    }, [tasks]);
    React.useEffect(() => () => { if (recentTimer.current) clearTimeout(recentTimer.current); }, []);

    function zoomBy(factor) { apply(zoomAt(current, factor, { x: size.width / 2, y: size.height / 2 })); }
    function locate() {
      const node = graph?.nodes.find(candidate => candidate.id === selectedId);
      if (!node) return;
      apply(centerNode(current, node, size, nodeWidth, nodeHeight));
    }
    function onPointerDown(event) {
      // Right button pans anywhere (including over a card); middle never pans.
      if (event.button === 1) { event.preventDefault?.(); return; }
      if (event.button !== 0 && event.button !== 2) return;
      const target = event.target;
      // A left press on a card selects; only empty canvas pans with the left button.
      if (event.button === 0 && target?.closest?.('.gwo-node')) return;
      dragging.current = { x: event.clientX, y: event.clientY, pan: current.pan };
      setPanning(true);
      const element = viewport.current;
      if (element?.setPointerCapture && event.pointerId !== undefined) { try { element.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ } }
    }
    function onPointerMove(event) {
      if (!dragging.current) return;
      const dx = event.clientX - dragging.current.x, dy = event.clientY - dragging.current.y;
      apply({ zoom: current.zoom, pan: { x: dragging.current.pan.x + dx, y: dragging.current.pan.y + dy } });
    }
    function endDrag() { dragging.current = null; setPanning(false); }
    function onContextMenu(event) {
      // Right-drag must not pop the browser menu, including when it starts on a card.
      event.preventDefault?.();
      return false;
    }
    function onKeyDown(event) {
      const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (keys[event.key]) {
        event.preventDefault();
        const [dx, dy] = keys[event.key];
        const step = event.shiftKey ? PAN_STEP * 5 : PAN_STEP;
        apply(panBy(current, dx * step, dy * step));
      } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.15); }
      else if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.15); }
      else if (event.key === '0') { event.preventDefault(); apply(null); }
      else if (event.key === 'f' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); locate(); }
    }
    function onNodeKeyDown(event, node) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key.replace('Arrow', '').toLowerCase();
      const next = nearestNeighbor(graph.nodes, node.id, direction, nodeWidth, nodeHeight);
      if (!next) return;
      onSelect(next);
      const element = nodeRefs.current.get(next);
      if (element && typeof element.focus === 'function') element.focus();
    }

    const header = h('div', { className: 'gwo-panel-head' },
      h('strong', null, t('map')),
      h('span', { className: 'gwo-muted' }, `${counts.ids} ${t('graphNodes')} · ${counts.edges} ${t('graphEdges')}`),
      graph && graph.parallel.length > 1 && h('span', { className: 'gwo-chip', title: t('parallelHint') }, `${t('parallelReady')} ${graph.parallel.length}`),
      h('div', { className: 'gwo-zoom' },
        button('−', () => zoomBy(1 / 1.15), { 'aria-label': t('zoomOut'), disabled: !open || scale <= MIN_ZOOM }),
        h('span', { className: 'gwo-zoom-value' }, `${Math.round(scale * 100)}%`),
        button('+', () => zoomBy(1.15), { 'aria-label': t('zoomIn'), disabled: !open || scale >= MAX_ZOOM }),
        button(t('fit'), () => apply(null), { 'aria-pressed': !view, disabled: !open }),
        button('1:1', () => apply({ zoom: 1, pan: current.pan }), { 'aria-pressed': scale === 1, disabled: !open }),
        button(t('locate'), locate, { disabled: !open || !selectedId }),
        button(motion ? t('motionOff') : t('motionOn'), () => { const next = !motion; setMotion(next); persist({ motion: next }); }, { 'aria-pressed': motion, title: t('motionHint') }),
        button(layout === 'organic' ? t('layoutLayered') : t('layoutOrganic'), () => { const next = layout === 'organic' ? 'layered' : 'organic'; setLayout(next); persist({ layout: next }); }, { 'aria-pressed': layout === 'organic', title: t('layoutHint') })),
      h('button', { type: 'button', className: 'gwo-collapse', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': `${uid.current}-body`, onClick: () => {
        const next = !open;
        setOpen(next);
        persist({ open: next });
        if (!next) {
          const element = section.current?.querySelector?.('.gwo-collapse');
          if (element && typeof element.focus === 'function') element.focus();
        }
      } }, open ? t('collapse') : t('expand')));

    return h('section', { className: `gwo-panel gwo-map${open ? '' : ' gwo-map-closed'}`, 'aria-label': t('map'), ref: section, 'data-motion': motion ? 'on' : 'off' },
      header,
      open && h(Legend),
      open && graph && graph.parallel.length > 1 && h('p', { className: 'gwo-map-hint gwo-muted' }, t('parallelHint').replace('{n}', String(graph.parallel.length))),
      open && h('div', { className: 'gwo-viewport', id: `${uid.current}-body`, ref: viewport, tabIndex: 0, role: 'group', 'aria-label': t('map'), 'aria-roledescription': t('panHint'),
        'data-panning': panning ? 'true' : undefined,
        onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown, onContextMenu },
        graph.empty
          ? h('p', { className: 'gwo-muted gwo-map-empty' }, t('graphEmpty'))
          : h('div', { className: 'gwo-plane', style: { width: graph.width, height: graph.height, transform: `translate(${current.pan.x}px, ${current.pan.y}px) scale(${scale})` } },
            h('svg', { className: 'gwo-edges', width: graph.width, height: graph.height, viewBox: `0 0 ${graph.width} ${graph.height}`, 'aria-hidden': 'true' },
              h('defs', null,
                h('marker', { id: `${uid.current}-arrow`, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, h('path', { d: 'M0,0 L8,4 L0,8 z', className: 'gwo-arrow' })),
                h('marker', { id: `${uid.current}-arrow-active`, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, h('path', { d: 'M0,0 L8,4 L0,8 z', className: 'gwo-arrow-active' }))),
              ...edgeElements(graph, selectedId, nodeWidth, nodeHeight)),
            ...nodeElements(graph, selectedId, nodeWidth, nodeHeight)),
        h('ul', { className: 'gwo-sr' }, ...graph.nodes.map(node => h('li', { key: node.id }, `${node.label} (${node.id}) ${t(node.status)}: ${node.depends.length ? node.depends.join(', ') : t('none')}`)))),
      open && graph && hintRows(graph, counts, oversized, showAll, limits, t, {
        onShowAll: () => setShowAll(true),
        onFocusOnly: () => { setShowAll(false); locate(); },
      }));

    function edgeElements(current, selected, width, height) {
      const positions = new Map(current.nodes.map(node => [node.id, node]));
      const linked = selected ? linkedIds(current, selected) : new Set();
      const emphasise = linked.size > 1;
      return current.edges.map(edge => {
        const from = positions.get(edge.from), to = positions.get(edge.to);
        if (!from || !to) return null;
        const on = emphasise && linked.has(edge.from) && linked.has(edge.to);
        // Flowing dashes mark an arrow whose target is in flight; a short burst marks a
        // ticket that just progressed. Both are decoration on top of the static colour.
        const flow = recentEdges?.has(`*:${edge.to}`) ? 'recent' : (to.status === 'doing' ? 'active' : undefined);
        return h('path', {
          key: `${edge.from}>${edge.to}`,
          d: edgePath(from, to, { span: Math.max(1, to.layer - from.layer) }),
          className: `gwo-edge${on ? ' gwo-edge-active' : ''}${emphasise && !on ? ' gwo-edge-dim' : ''}`,
          'data-flow': flow,
          'marker-end': `url(#${uid.current}-${on || flow === 'active' ? 'arrow-active' : 'arrow'})`,
        });
      });
    }

    function nodeElements(current, selected, width, height) {
      const linked = selected ? linkedIds(current, selected) : new Set();
      const emphasise = linked.size > 1;
      return current.nodes.map((node, index) => h('button', {
        type: 'button', key: node.id, ref: element => { if (element) nodeRefs.current.set(node.id, element); else nodeRefs.current.delete(node.id); },
        className: 'gwo-node', 'data-state': node.status, 'data-selected': node.id === selected ? '' : undefined,
        'data-dim': emphasise && !linked.has(node.id) ? '' : undefined, 'data-next': node.next ? '' : undefined,
        'data-ready': node.ready ? '' : undefined,
        'data-parallel': node.ready && !node.next ? '' : undefined,
        tabIndex: node.id === selected || (!selected && index === 0) ? 0 : -1,
        'aria-pressed': node.id === selected,
        'aria-label': `${node.label} · ${node.id} · ${t(node.status)} · ${node.items.done}/${node.items.total}${node.depends.length ? ` · ${t('depends')} ${node.depends.join(', ')}` : ''}`,
        title: `${node.label} · ${node.id}`,
        style: { left: node.x, top: node.y, width, height },
        onClick: () => onSelect(node.id),
        onKeyDown: event => onNodeKeyDown(event, node),
      },
      h('span', { className: 'gwo-node-head' }, h('strong', null, node.label), node.next ? h('span', { className: 'gwo-node-flag', title: t('next') }, '▶') : null),
      h('span', { className: 'gwo-node-id' }, node.id),
      h('span', { className: 'gwo-node-foot' },
        h('span', { className: 'gwo-state', 'data-state': node.status }, t(node.status)),
        node.ready ? h('span', { className: 'gwo-node-ready' }, t('ready')) : null,
        h('span', { className: 'gwo-node-items' }, `${node.items.done}/${node.items.total}`)),
      h('progress', { max: Math.max(1, node.items.total), value: node.items.done, 'aria-label': t('items') })));
    }
  }

  function hintRows(graph, counts, oversized, showAll, limits, t, actions) {
    const rows = [];
    if (graph.empty) rows.push(h('p', { key: 'empty', className: 'gwo-muted gwo-map-hint' }, t('graphEmpty')));
    else if (graph.isolated) rows.push(h('p', { key: 'isolated', className: 'gwo-muted gwo-map-hint' }, t('graphIsolated')));
    else rows.push(h('p', { key: 'hint', className: 'gwo-muted gwo-map-hint' }, t('panHint')));
    if (oversized && !showAll) {
      rows.push(h('p', { key: 'large', className: 'gwo-note gwo-warn' },
        `${t('graphLarge')} (${t('graphNodes')} ${counts.ids} > ${limits.nodes}${counts.edges > limits.edges ? `, ${t('graphEdges')} ${counts.edges} > ${limits.edges}` : ''})`,
        button(t('graphFull'), actions.onShowAll)));
    }
    if (oversized && showAll) {
      rows.push(h('p', { key: 'all', className: 'gwo-note gwo-warn' }, t('graphFullHint'), button(t('graphFocus'), actions.onFocusOnly)));
    }
    if (graph.truncated?.nodes || graph.truncated?.edges) {
      rows.push(h('p', { key: 'truncated', className: 'gwo-note gwo-warn' }, `${t('graphTruncated')}: ${graph.truncated.nodes} ${t('graphNodes')}, ${graph.truncated.edges} ${t('graphEdges')}`));
    }
    for (const issue of graph.issues) {
      if (issue.kind === 'cycle') rows.push(h('p', { key: `cycle-${issue.ids.join('-')}`, className: 'gwo-note gwo-warn' }, `${t('graphCycle')}: ${issue.ids.join(', ')}`));
      else if (issue.kind === 'unreachable') rows.push(h('p', { key: `unreachable-${issue.ids.join('-')}`, className: 'gwo-note gwo-warn' }, `${t('graphUnreachable')}: ${issue.ids.join(', ')}`));
      else if (issue.kind === 'missing') rows.push(h('p', { key: `missing-${issue.id}-${issue.dependency}`, className: 'gwo-note gwo-warn' }, `${t('graphMissing')}: ${issue.id} → ${issue.dependency}`));
      else if (issue.kind === 'duplicate') rows.push(h('p', { key: `duplicate-${issue.id}`, className: 'gwo-note gwo-warn' }, `${t('graphDuplicate')}: ${issue.id}`));
    }
    return rows;
  }

  return { MapView };
}
