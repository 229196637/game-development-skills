/**
 * Rule normalization and matching shared by the Host half and the tests.
 *
 * The Client half carries a copy of `relPath` / `isHidden` / `groupFiles`
 * because a browser module bundle cannot import this file at runtime; the two
 * copies must stay behaviourally identical (see README "规则语义").
 */

const MAX_ENTRIES = 200;
const MAX_LEN = 200;

/** Normalize one directory entry: `./Docs/` and `docs\` both become `docs`. */
function normalizeDir(value) {
  return String(value)
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/** Normalize one extension entry: `meta` and `.META` both become `.meta`. */
function normalizeExt(value) {
  const text = String(value).trim().toLowerCase();
  if (text === '' || text === '.') return '';
  return text.startsWith('.') ? text : `.${text}`;
}

function collect(list, normalize) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const value = normalize(item);
    if (value === '' || value === '.') continue;
    if (value.length > MAX_LEN) continue;
    if (out.includes(value)) continue;
    out.push(value);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out.sort();
}

/**
 * Normalize a stored or submitted rules object.
 * Anything unreadable collapses to the empty rules, which never hides a file.
 */
export function normalizeRules(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { dirs: [], exts: [] };
  }
  return {
    dirs: collect(input.dirs, normalizeDir),
    exts: collect(input.exts, normalizeExt),
  };
}

/** Turn an absolute or relative path into its workspace-relative form. */
export function relPath(path, cwd) {
  if (typeof path !== 'string') return '';
  let p = path.replace(/\\/g, '/');
  if (typeof cwd === 'string' && cwd !== '') {
    const base = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
    if (p.toLowerCase().startsWith(`${base.toLowerCase()}/`)) {
      return p.slice(base.length + 1);
    }
  }
  return p.replace(/^\.\//, '');
}

/** True when the file is outside the workspace or an absolute path. */
export function isExternal(p) {
  return p.startsWith('/') || /^[a-zA-Z]:\//.test(p);
}

/**
 * Directory prefixes match whole segments, extensions match the tail.
 * `docs` hides `docs/a.md` and `docs/b/c.md`, never `docs2/a.md`.
 */
export function isHidden(relativePath, rules) {
  if (typeof relativePath !== 'string' || relativePath === '') return false;
  const p = relativePath.replace(/\\/g, '/').toLowerCase();
  for (const ext of rules.exts) if (p.endsWith(ext)) return true;
  for (const dir of rules.dirs) {
    if (p === dir || p.startsWith(`${dir}/`)) return true;
  }
  return false;
}

/** Group kept files by their first path segment, keeping original indices. */
export function groupFiles(items) {
  const groups = new Map();
  for (const item of items) {
    const p = item.relative;
    let key;
    if (isExternal(p)) key = { id: '__external__', label: item.externalLabel ?? '外部路径' };
    else if (p.includes('/')) key = { id: p.slice(0, p.indexOf('/')), label: p.slice(0, p.indexOf('/')) };
    else key = { id: '__root__', label: item.rootLabel ?? '根目录' };
    const bucket = groups.get(key.id);
    if (bucket === undefined) {
      groups.set(key.id, { id: key.id, label: key.label, files: [item], added: item.added, deleted: item.deleted });
    } else {
      bucket.files.push(item);
      bucket.added += item.added;
      bucket.deleted += item.deleted;
    }
  }
  const list = [...groups.values()];
  list.sort((left, right) => {
    if (right.files.length !== left.files.length) return right.files.length - left.files.length;
    return left.label.localeCompare(right.label);
  });
  return list;
}
