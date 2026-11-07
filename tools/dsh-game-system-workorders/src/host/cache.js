import path from 'node:path';

const DEFAULT_MAX_ENTRIES = 8;
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const DISCOVER_MAX_AGE_MS = 60 * 1000;

/** A filesystem-shaped string we are willing to probe; free-text evidence is skipped. */
export function looksLikePath(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 512) return false;
  if (/[\r\n]/.test(text)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return false;
  if (/\s/.test(text)) return false;
  return /[\\/]/.test(text) || /\.[a-z0-9]{1,8}$/i.test(text);
}

/**
 * Paths whose identity decides whether a stored snapshot is still current.
 * Derived from the snapshot itself, so the Python side stays untouched.
 */
export function fingerprintPaths(snapshot, root) {
  const files = new Set();
  const add = value => { if (looksLikePath(value)) files.add(path.resolve(String(value).trim())); };
  add(root);
  add(snapshot?.root);
  add(snapshot?.readme);
  for (const task of Array.isArray(snapshot?.tasks) ? snapshot.tasks : []) {
    add(task?.file);
    add(task?.document);
    for (const reference of Array.isArray(task?.references) ? task.references : []) add(reference);
    for (const record of Array.isArray(task?.latest_tests) ? task.latest_tests : []) add(record?.report);
    for (const record of Array.isArray(task?.latest_acceptance) ? task.latest_acceptance : []) add(record?.evidence);
  }
  return [...files].sort();
}

async function probe(fs, file, signal) {
  try {
    const target = await fs.resolve(file, { signal });
    const info = await fs.stat(target, signal);
    if (!info) return 'absent';
    // versionOf() already folds dev/ino/size/mtimeNs/ctimeNs into an opaque token.
    return `${info.type || 'other'}|${info.size ?? ''}|${info.version ?? ''}`;
  } catch {
    return 'absent';
  }
}

/**
 * Memory cache of workorder snapshots, validated by cheap filesystem probes.
 * A hit means "no file that fed this snapshot changed"; it never means "authoritative".
 */
export function createSnapshotCache(options = {}) {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = options.now ?? Date.now;
  const entries = new Map();
  const inflight = new Map();

  async function stampFor(root, snapshot, fs, signal) {
    const files = fingerprintPaths(snapshot, root);
    const directories = [...new Set(files.map(file => path.dirname(file)))].sort();
    const rows = [];
    for (const file of files) rows.push(`f:${file}=${await probe(fs, file, signal)}`);
    // A directory token changes when entries are added, removed, or renamed.
    for (const directory of directories) rows.push(`d:${directory}=${await probe(fs, directory, signal)}`);
    return rows.join('\n');
  }

  function evict() {
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  async function store(root, snapshot, fs, signal) {
    let stamp;
    try { stamp = await stampFor(root, snapshot, fs, signal); }
    catch { return; }
    entries.delete(root);
    entries.set(root, { stamp, snapshot, storedAt: now() });
    evict();
  }

  async function lookup(root, fs, signal) {
    const entry = entries.get(root);
    if (!entry) return null;
    if (now() - entry.storedAt > maxAgeMs) { entries.delete(root); return null; }
    let stamp;
    try { stamp = await stampFor(root, entry.snapshot, fs, signal); }
    catch { return null; }
    if (stamp !== entry.stamp) { entries.delete(root); return null; }
    entries.delete(root);
    entries.set(root, entry);
    return { snapshot: entry.snapshot, storedAt: entry.storedAt };
  }

  return {
    async run(root, fs, produce, signal, { fresh = false } = {}) {
      if (!fresh) {
        const hit = await lookup(root, fs, signal);
        if (hit) return { value: hit.snapshot, cached: true, storedAt: hit.storedAt };
      }
      if (fresh) {
        const value = await produce();
        await store(root, value, fs, signal);
        return { value, cached: false, storedAt: now() };
      }
      // One shared run per root: a single unmount must not abort other callers.
      let pending = inflight.get(root);
      if (!pending) {
        pending = (async () => produce())().finally(() => inflight.delete(root));
        inflight.set(root, pending);
      }
      const value = await pending;
      await store(root, value, fs, signal);
      return { value, cached: false, storedAt: now() };
    },
    async clear(root) {
      if (root === undefined) { entries.clear(); inflight.clear(); return; }
      entries.delete(root);
    },
    peek(root) { return entries.get(root) || null; },
    size() { return entries.size; },
    maxAgeMs,
  };
}

/** Short-lived memo for directory scans, which only feed the task picker. */
export function createDiscoverCache(options = {}) {
  const maxAgeMs = options.maxAgeMs ?? DISCOVER_MAX_AGE_MS;
  const maxEntries = options.maxEntries ?? 16;
  const now = options.now ?? Date.now;
  const entries = new Map();
  const inflight = new Map();

  return {
    keyOf(cwd, start, includeCompleted) {
      return `${cwd}\u0000${start}\u0000${includeCompleted ? 1 : 0}`;
    },
    async run(key, produce, { fresh = false } = {}) {
      if (!fresh) {
        const entry = entries.get(key);
        if (entry && now() - entry.storedAt <= maxAgeMs) {
          entries.delete(key);
          entries.set(key, entry);
          return { value: entry.value, cached: true, storedAt: entry.storedAt };
        }
        if (entry) entries.delete(key);
      }
      if (fresh) {
        const value = await produce();
        entries.set(key, { value, storedAt: now() });
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        return { value, cached: false, storedAt: now() };
      }
      let pending = inflight.get(key);
      if (!pending) {
        pending = (async () => produce())().finally(() => inflight.delete(key));
        inflight.set(key, pending);
      }
      const value = await pending;
      entries.set(key, { value, storedAt: now() });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return { value, cached: false, storedAt: now() };
    },
    clear() { entries.clear(); inflight.clear(); },
    size() { return entries.size; },
    maxAgeMs,
  };
}
