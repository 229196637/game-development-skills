// Read-only dependency layout for one task snapshot.
// Pure functions only: no ctx, no DOM, no network. Callers pass the snapshot tasks.
export const NODE_W = 208;
export const NODE_H = 64;
export const GAP_X = 30;
export const GAP_Y = 78;
export const MAX_NODES = 500;
export const MAX_EDGES = 2000;

function dependencies(task) {
  const value = task?.depends_on;
  return Array.isArray(value) ? value.filter(dep => typeof dep === 'string' && dep) : [];
}

function uniqueTasks(tasks) {
  const byId = new Map();
  const order = [];
  const duplicates = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task || typeof task.id !== 'string' || !task.id) continue;
    if (byId.has(task.id)) { duplicates.push(task.id); continue; }
    byId.set(task.id, task);
    order.push(task.id);
  }
  return { byId, order, duplicates };
}

// Cheap pre-check: count ids and dependency edges without laying anything out.
// The viewport calls this first so a 10k snapshot never reaches the layout pass.
export function countGraph(tasks) {
  const { byId, order, duplicates } = uniqueTasks(tasks);
  const seen = new Set();
  let edges = 0, missing = 0;
  for (const id of order) {
    for (const dep of dependencies(byId.get(id))) {
      if (!byId.has(dep)) { missing++; continue; }
      const key = `${dep}\u0000${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges++;
    }
  }
  return { ids: order.length, edges, duplicate: duplicates.length, missing };
}

// Node ids related to `id`: itself, what it waits for, and what waits for it.
export function relatedTasks(tasks, id) {
  const result = new Set();
  if (typeof id !== 'string' || !id) return result;
  result.add(id);
  const list = Array.isArray(tasks) ? tasks : [];
  for (const task of list) {
    if (!task || typeof task.id !== 'string') continue;
    if (dependencies(task).includes(id)) result.add(task.id);
    if (task.id === id) for (const dep of dependencies(task)) result.add(dep);
  }
  return result;
}

// Breadth-first closure around `id` (prerequisites first, then dependents), capped.
// Used to draw a readable neighbourhood instead of a 10k node map.
export function focusSet(tasks, id, max = MAX_NODES) {
  const { byId, order } = uniqueTasks(tasks);
  const forwards = new Map(), backwards = new Map();
  for (const key of order) {
    for (const dep of dependencies(byId.get(key))) {
      if (!byId.has(dep)) continue;
      if (!forwards.has(dep)) forwards.set(dep, []);
      forwards.get(dep).push(key);
      if (!backwards.has(key)) backwards.set(key, []);
      backwards.get(key).push(dep);
    }
  }
  const result = new Set();
  const start = typeof id === 'string' && byId.has(id) ? id : order[0];
  if (!start) return result;
  const queue = [start];
  result.add(start);
  while (queue.length && result.size < max) {
    const current = queue.shift();
    for (const next of [...(backwards.get(current) || []), ...(forwards.get(current) || [])]) {
      if (result.has(next)) continue;
      result.add(next);
      if (result.size >= max) break;
      queue.push(next);
    }
  }
  return result;
}

// Tarjan strongly connected components; only real cycles (size > 1 or a self loop) matter.
function stronglyConnected(order, out) {
  let counter = 0;
  const index = new Map(), low = new Map(), stack = [], onStack = new Set();
  const components = [];
  const visit = start => {
    // Iterative DFS keeps a deep chain from overflowing the call stack.
    const work = [{ id: start, next: 0 }];
    index.set(start, counter); low.set(start, counter); counter++;
    stack.push(start); onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1];
      const children = out.get(frame.id) || [];
      if (frame.next < children.length) {
        const child = children[frame.next++];
        if (!index.has(child)) {
          index.set(child, counter); low.set(child, counter); counter++;
          stack.push(child); onStack.add(child);
          work.push({ id: child, next: 0 });
        } else if (onStack.has(child)) {
          low.set(frame.id, Math.min(low.get(frame.id), index.get(child)));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].id;
        low.set(parent, Math.min(low.get(parent), low.get(frame.id)));
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        const component = [];
        let member;
        do { member = stack.pop(); onStack.delete(member); component.push(member); } while (member !== frame.id);
        components.push(component);
      }
    }
  };
  for (const id of order) if (!index.has(id)) visit(id);
  return components;
}

export function buildGraph(tasks, options = {}) {
  const { byId, order, duplicates } = uniqueTasks(tasks);
  const maxNodes = options.maxNodes ?? MAX_NODES;
  const maxEdges = options.maxEdges ?? MAX_EDGES;
  const known = options.known instanceof Set ? options.known : new Set(order);
  const wanted = id => (options.include instanceof Set ? options.include.has(id) : typeof options.include === 'function' ? options.include(id) : true);
  const issues = [];
  for (const id of duplicates) issues.push({ kind: 'duplicate', id });

  const candidates = order.filter(wanted);
  const candidateSet = new Set(candidates);
  const index = new Map(order.map((id, position) => [id, position]));

  // Missing prerequisites are judged against the whole snapshot, never against the
  // drawn subset: a filtered map must not invent "this prerequisite is gone".
  for (const id of candidates) {
    for (const dep of dependencies(byId.get(id))) {
      if (known.has(dep)) continue;
      if (!issues.some(issue => issue.kind === 'missing' && issue.id === id && issue.dependency === dep)) {
        issues.push({ kind: 'missing', id, dependency: dep });
      }
    }
  }

  const linksOf = id => dependencies(byId.get(id)).filter(dep => candidateSet.has(dep));
  let kept = candidates;
  const truncated = { nodes: 0, edges: 0 };
  let edgesDropped = 0;
  if (candidates.length > maxNodes) {
    // Focus first, then the surrounding closure, then the snapshot order.
    const focus = typeof options.focus === 'string' && candidateSet.has(options.focus) ? options.focus : candidates[0];
    const closure = focusSet(candidates.map(id => byId.get(id)), focus, maxNodes);
    const ordered = [...closure, ...candidates.filter(id => !closure.has(id))];
    kept = ordered.slice(0, maxNodes);
    truncated.nodes = candidates.length - kept.length;
  }
  const keptSet = new Set(kept);
  let edges = [];
  const edgeKeys = new Set();
  for (const id of kept) {
    for (const dep of linksOf(id)) {
      if (!keptSet.has(dep)) { edgesDropped++; continue; }
      const key = `${dep}\u0000${id}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: dep, to: id });
    }
  }
  if (edges.length > maxEdges) {
    truncated.edges = edges.length - maxEdges;
    edges = edges.slice(0, maxEdges);
  }

  // Strongly connected components give the real cycle members; their descendants are
  // merely unreachable, not part of the cycle.
  const out = new Map(kept.map(id => [id, []]));
  for (const edge of edges) out.get(edge.from).push(edge.to);
  const components = stronglyConnected(kept, out);
  const cyclic = new Set();
  for (const component of components) {
    if (component.length > 1) for (const id of component) cyclic.add(id);
  }
  for (const edge of edges) if (edge.from === edge.to) cyclic.add(edge.from);
  if (cyclic.size) {
    const ids = kept.filter(id => cyclic.has(id));
    issues.push({ kind: 'cycle', ids });
  }

  // Anything that transitively waits on a cycle can never start. It is unreachable, not a
  // root, so it must not be drawn as one.
  const deadlocked = new Set();
  for (let grew = true; grew;) {
    grew = false;
    for (const id of kept) {
      if (cyclic.has(id) || deadlocked.has(id)) continue;
      if (linksOf(id).some(dep => cyclic.has(dep) || deadlocked.has(dep))) { deadlocked.add(id); grew = true; }
    }
  }

  // Kahn topological order over the acyclic part.
  const indegree = new Map(kept.map(id => [id, 0]));
  for (const edge of edges) {
    if (cyclic.has(edge.from) || cyclic.has(edge.to) || edge.from === edge.to) continue;
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  }
  const ready = kept.filter(id => !cyclic.has(id) && !deadlocked.has(id) && indegree.get(id) === 0).sort((a, b) => index.get(a) - index.get(b));
  const topo = [];
  while (ready.length) {
    const id = ready.shift();
    topo.push(id);
    for (const child of out.get(id) || []) {
      if (!indegree.has(child) || cyclic.has(child) || deadlocked.has(child)) continue;
      const left = indegree.get(child) - 1;
      indegree.set(child, left);
      if (left === 0) ready.push(child);
    }
    ready.sort((a, b) => index.get(a) - index.get(b));
  }
  const reached = new Set(topo);
  const unreachable = kept.filter(id => !reached.has(id) && !cyclic.has(id));
  if (unreachable.length) issues.push({ kind: 'unreachable', ids: unreachable });

  const layerOf = new Map();
  for (const id of topo) {
    let layer = 0;
    for (const dep of linksOf(id)) {
      const depLayer = layerOf.get(dep);
      if (depLayer !== undefined) layer = Math.max(layer, depLayer + 1);
    }
    layerOf.set(id, layer);
  }
  // With no acyclic node at all, cycles occupy the first row instead of an empty one.
  const deepest = topo.length ? topo.reduce((max, id) => Math.max(max, layerOf.get(id)), 0) : -1;
  const cycleIds = kept.filter(id => cyclic.has(id));
  const cycleRow = deepest + 1;
  for (const id of cycleIds) layerOf.set(id, cycleRow);
  const unreachableRow = deepest + 1 + (cycleIds.length ? 1 : 0);
  for (const id of unreachable) layerOf.set(id, unreachableRow);

  // Only edges whose both ends sit on an ordered layer can be drawn top-down.
  const drawable = edges.filter(edge => edge.from !== edge.to && reached.has(edge.from) && reached.has(edge.to));
  const skippedEdges = edges.length - drawable.length;
  drawable.sort((a, b) => (layerOf.get(a.from) - layerOf.get(b.from))
    || (layerOf.get(a.to) - layerOf.get(b.to))
    || (index.get(a.from) - index.get(b.from))
    || (index.get(a.to) - index.get(b.to)));

  const layerValues = kept.map(id => layerOf.get(id) ?? 0);
  const rowCount = layerValues.length ? Math.max(...layerValues) + 1 : 0;
  const columns = Array.from({ length: Math.max(rowCount, 1) }, () => []);
  for (const id of kept) columns[layerOf.get(id) ?? 0].push(id);

  // Deterministic barycentre ordering: stable for an unchanged dependency graph.
  const neighbours = new Map(kept.map(id => [id, []]));
  for (const edge of drawable) {
    neighbours.get(edge.from).push(edge.to);
    neighbours.get(edge.to).push(edge.from);
  }
  for (let pass = 0; pass < 4; pass++) {
    const downward = pass % 2 === 0;
    const sequence = [];
    if (downward) for (let layer = 1; layer < columns.length; layer++) sequence.push(layer);
    else for (let layer = columns.length - 2; layer >= 0; layer--) sequence.push(layer);
    for (const layer of sequence) {
      const reference = downward ? layer - 1 : layer + 1;
      const positions = new Map(columns[reference].map((id, position) => [id, position]));
      const scored = columns[layer].map((id, position) => {
        const linked = neighbours.get(id).filter(other => positions.has(other));
        const score = linked.length ? linked.reduce((sum, other) => sum + positions.get(other), 0) / linked.length : position;
        return { id, score, position };
      });
      scored.sort((a, b) => a.score - b.score || a.position - b.position);
      columns[layer] = scored.map(entry => entry.id);
    }
  }

  const rowWidth = layer => (columns[layer]?.length || 0) * (NODE_W + GAP_X) - GAP_X;
  const baseWidth = Math.max(...columns.map((_, layer) => rowWidth(layer)), 1);
  const nextId = typeof options.next === 'string' ? options.next : options.next?.id;
  const readyIds = new Set(Array.isArray(options.ready) ? options.ready : []);
  const dependents = new Map(kept.map(id => [id, []]));
  for (const edge of edges) dependents.get(edge.from)?.push(edge.to);

  // Organic keeps the layer constraint (so dependencies still read top-down) but lets rows
  // drift toward their parents and stagger, which removes the "one straight grid" look.
  const layoutMode = options.layout === 'layered' ? 'layered' : 'organic';
  const placed = placeNodes({ columns, layerOf, drawable, layoutMode, baseWidth });
  const nodes = [];
  columns.forEach((column, layer) => {
    column.forEach(id => {
      const task = byId.get(id);
      const items = Array.isArray(task.items) ? task.items : [];
      const checked = items.filter(item => item && (item[0] === 'x' || item[0] === 'X' || item[0] === true)).length;
      const deps = dependencies(task);
      const readyByState = task.status === 'todo' && !task.claim && deps.every(dep => byId.get(dep)?.status === 'completed');
      const point = placed.points.get(id);
      nodes.push({
        id,
        label: task.class || id,
        status: task.status || 'todo',
        claim: task.claim || '',
        layer,
        x: point.x,
        y: point.y,
        depends: deps.slice(),
        dependents: dependents.get(id).slice(),
        items: { done: checked, total: items.length },
        ready: readyIds.has(id) || readyByState,
        next: nextId === id,
      });
    });
  });
  const parallel = nodes.filter(node => node.ready).map(node => node.id);

  const oversized = truncated.nodes > 0 || truncated.edges > 0;
  const missing = issues.filter(issue => issue.kind === 'missing');
  return {
    nodes,
    edges: drawable,
    layers: columns.map(column => column.length),
    waves: columns.map(column => column.slice()),
    parallel,
    layout: layoutMode,
    width: placed.width,
    height: placed.height,
    nodeWidth: NODE_W,
    nodeHeight: NODE_H,
    issues,
    large: oversized,
    limits: { nodes: maxNodes, edges: maxEdges },
    truncated,
    skippedEdges,
    edgesDropped,
    counts: { nodes: nodes.length, edges: drawable.length, known: known.size, candidates: candidates.length },
    empty: nodes.length === 0,
    isolated: nodes.length > 0 && drawable.length === 0 && !missing.length && !cyclic.size,
  };
}

// Ancestors and descendants of one node, used to emphasise the selected chain.
export function linkedIds(graph, id) {
  const result = new Set();
  if (!graph || typeof id !== 'string' || !id) return result;
  const forwards = new Map();
  const backwards = new Map();
  for (const edge of graph.edges || []) {
    if (!forwards.has(edge.from)) forwards.set(edge.from, []);
    if (!backwards.has(edge.to)) backwards.set(edge.to, []);
    forwards.get(edge.from).push(edge.to);
    backwards.get(edge.to).push(edge.from);
  }
  const walk = map => {
    const queue = [id];
    while (queue.length) {
      const current = queue.shift();
      for (const next of map.get(current) || []) {
        if (next === id || result.has(next)) continue;
        result.add(next);
        queue.push(next);
      }
    }
  };
  walk(forwards);
  walk(backwards);
  result.add(id);
  return result;
}

// Stable 32-bit hash: keeps the organic layout reproducible between renders and machines.
export function hash32(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function placeNodes({ columns, layerOf, drawable, layoutMode, baseWidth }) {
  const points = new Map();
  const x = new Map();
  const y = new Map();
  columns.forEach((column, layer) => {
    const pitch = NODE_W + GAP_X + (layoutMode === 'organic' ? (layer % 3) * 12 : 0);
    const span = (column.length - 1) * pitch + NODE_W;
    const offset = layoutMode === 'layered' ? (baseWidth - span) / 2 : 0;
    column.forEach((id, position) => {
      x.set(id, offset + position * pitch);
      y.set(id, layer * (NODE_H + GAP_Y));
    });
  });
  if (layoutMode === 'layered') {
    const width = Math.max(baseWidth, NODE_W);
    const height = Math.max(columns.length * (NODE_H + GAP_Y) - GAP_Y, NODE_H);
    for (const id of x.keys()) points.set(id, { x: x.get(id), y: y.get(id) });
    return { points, width, height };
  }

  // Pull each row toward the average x of its prerequisites, so chains read as diagonals
  // instead of every row sitting on the same centre line.
  for (let layer = 1; layer < columns.length; layer++) {
    const parents = [];
    const children = [];
    for (const edge of drawable) {
      if ((layerOf.get(edge.to) ?? 0) !== layer) continue;
      if ((layerOf.get(edge.from) ?? 0) >= layer) continue;
      parents.push(x.get(edge.from) + NODE_W / 2);
      children.push(x.get(edge.to) + NODE_W / 2);
    }
    if (!parents.length) continue;
    const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
    const shift = Math.max(-140, Math.min(140, (mean(parents) - mean(children)) * 0.35));
    for (const id of columns[layer]) x.set(id, x.get(id) + shift);
  }

  for (const column of columns) {
    for (const id of column) {
      const hx = hash32(id);
      const hy = hash32(`${id}#y`);
      x.set(id, x.get(id) + (hx % 2 ? 1 : -1) * (4 + (hx % 9)));
      y.set(id, y.get(id) + ((hy % 5) - 2) * 5);
    }
  }

  // Same-row cards must not touch; rows are far enough apart that cross-row overlap is
  // impossible once the vertical stagger stays inside +-14.
  for (const column of columns) {
    const ordered = column.slice().sort((left, right) => x.get(left) - x.get(right) || (left < right ? -1 : 1));
    for (let index = 1; index < ordered.length; index++) {
      const need = x.get(ordered[index - 1]) + NODE_W + 18;
      if (x.get(ordered[index]) < need) x.set(ordered[index], need);
    }
  }

  const minX = Math.min(...x.values());
  const minY = Math.min(...y.values());
  for (const id of x.keys()) {
    const px = Math.round((x.get(id) - minX) * 2) / 2;
    const py = Math.round((y.get(id) - minY) * 2) / 2;
    points.set(id, { x: px, y: py });
  }
  const width = Math.max(...[...points.values()].map(point => point.x + NODE_W), NODE_W);
  const height = Math.max(...[...points.values()].map(point => point.y + NODE_H), NODE_H);
  return { points, width, height };
}

/**
 * Curved dependency arrow. The bow depends on the horizontal offset and the layer span, so
 * sibling edges fan out instead of all tracing the same vertical S.
 */
export function edgePath(from, to, options = {}) {
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;
  const span = options.span ?? Math.max(1, (to.layer ?? 0) - (from.layer ?? 0));
  const dx = x2 - x1;
  const vertical = Math.max(y2 - y1, 1);
  // Lean toward the target instead of bulging out both ways. A near-vertical
  // S-curve looks like two separate lines once the flow dashes hide its middle.
  const lean = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
  const magnitude = Math.min(Math.abs(dx) * 0.5, 88) * (span > 1 ? 1.3 : 1);
  const bow = options.bow === undefined ? lean * magnitude : options.bow;
  const c1x = Math.round(x1 + bow * 0.5);
  const c1y = Math.round(y1 + vertical * 0.4);
  const c2x = Math.round(x2 - bow * 0.5);
  const c2y = Math.round(y1 + vertical * 0.75);
  return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}
