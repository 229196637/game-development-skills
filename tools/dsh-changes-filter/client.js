/**
 * Client half of dsh-changes-filter.
 *
 * Re-registers the shipped `conversation.chat.turnTail` entry under the same id,
 * so this card replaces the native changed-files card while the native plugin
 * keeps owning the summary/diff/tab machinery and the turn-data definition.
 *
 * This file is served as a browser module bundle: no imports, no build step.
 * `relPath` / `isHidden` / `groupFiles` mirror lib/rules.js and must stay in sync.
 */
window.__ModuleLoader__.load({
  id: 'dsh-changes-filter',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh-changes-filter';
    const INTERNAL_ID = '@deepseek-ai/dsh-client-ui-deliverables';
    const RULES_ROUTE = '/dsh-changes-filter/rules.json';
    const SUMMARY_ROUTE = '/api/changes.summary';
    const COLLAPSED_ROWS = 4;
    const COLLAPSED_PRESENTED = 4;
    const EMPTY_RULES = { dirs: [], exts: [], noiseDirs: [] };

    //#region pure helpers (keep in sync with lib/rules.js)
    function relPath(path, cwd) {
      if (typeof path !== 'string') return '';
      const p = path.replace(/\\/g, '/');
      if (typeof cwd === 'string' && cwd !== '') {
        const base = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
        if (p.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return p.slice(base.length + 1);
      }
      return p.replace(/^\.\//, '');
    }

    function isExternal(p) {
      return p.startsWith('/') || /^[a-zA-Z]:\//.test(p);
    }

    function hiddenReason(relativePath, rules) {
      if (typeof relativePath !== 'string' || relativePath === '') return null;
      const p = relativePath.replace(/\\/g, '/').toLowerCase();
      for (const ext of rules.exts ?? []) if (p.endsWith(ext)) return 'manual';
      for (const dir of rules.dirs ?? []) if (p === dir || p.startsWith(`${dir}/`)) return 'manual';
      const directories = p.split('/').slice(0, -1);
      for (const dir of rules.noiseDirs ?? ['.agent-tmp']) if (directories.includes(dir)) return 'noise';
      return null;
    }

    function isHidden(relativePath, rules) {
      return hiddenReason(relativePath, rules) !== null;
    }

    function groupFiles(items, labels) {
      const groups = new Map();
      for (const item of items) {
        const p = item.relative;
        let id;
        let label;
        if (isExternal(p)) {
          id = '__external__';
          label = labels.external;
        } else if (p.includes('/')) {
          id = p.slice(0, p.indexOf('/')).toLowerCase();
          label = p.slice(0, p.indexOf('/'));
        } else {
          id = '__root__';
          label = labels.root;
        }
        const bucket = groups.get(id);
        if (bucket === undefined) {
          groups.set(id, { id, label, files: [item], added: item.added, deleted: item.deleted });
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

    function summaryKey(sessionId, seq) {
      return `${sessionId}:${seq}`;
    }

    function summaryUrl(sessionId, seq) {
      return `${SUMMARY_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq) })}`;
    }

    function parseLines(text) {
      return String(text)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
    }

    /**
     * Keep the latest declaration of each delivered path before the closing
     * reply, mirroring the shipped `presentedForClosing` so a replacing cell does
     * not resurrect files an earlier turn already announced.
     */
    function dedupePresented(data, ownerSeq) {
      const list = data !== null && data !== undefined && Array.isArray(data.presented) ? data.presented : [];
      const byPath = new Map();
      for (const file of list) {
        if (file === null || typeof file !== 'object' || typeof file.path !== 'string') continue;
        if (ownerSeq !== undefined && typeof file.seq === 'number' && file.seq >= ownerSeq) continue;
        byPath.set(file.path, file);
      }
      return [...byPath.values()];
    }
    //#endregion

    //#region file icons (inline SVG; no network, font or package dependency)
    const FILE_TYPES = new Map();
    function defineFileType(exts, kind, label, color) {
      const icon = Object.freeze({ kind, label, color });
      for (const ext of exts.split(' ')) FILE_TYPES.set(ext, icon);
    }
    defineFileType('cs csx', 'csharp', 'C#', '#a970dc');
    defineFileType('js mjs cjs', 'javascript', 'JS', '#d6b52d');
    defineFileType('ts mts cts', 'typescript', 'TS', '#398bd8');
    defineFileType('jsx', 'react', 'JSX', '#39a9c4');
    defineFileType('tsx', 'react', 'TSX', '#398bd8');
    defineFileType('json jsonc json5', 'json', '{}', '#bf9a32');
    defineFileType('lua', 'lua', 'Lua', '#638bd6');
    defineFileType('py pyw pyi', 'python', 'Py', '#4b94bd');
    defineFileType('css scss sass less', 'css', '#', '#8e79d6');
    defineFileType('html htm vue svelte', 'markup', '</>', '#d77a4e');
    defineFileType('md mdx markdown', 'markdown', 'M', '#609abf');
    defineFileType('yaml yml toml ini cfg conf xml', 'config', '=', '#9b9370');
    defineFileType('shader hlsl glsl cg compute', 'shader', 'Sh', '#c675ad');
    defineFileType('unity prefab asset meta mat asmdef asmref', 'unity', 'U', '#8995a6');
    defineFileType('png jpg jpeg gif webp svg ico bmp tga psd', 'image', 'Image', '#65a47d');
    defineFileType('sh bash zsh ps1 bat cmd', 'shell', '>_', '#6caa87');
    defineFileType('c h cpp cc cxx hpp', 'cpp', 'C', '#6c95ca');
    defineFileType('java kt kts', 'java', 'J', '#c98b56');
    defineFileType('rs', 'rust', 'Rs', '#ba866c');
    defineFileType('go', 'go', 'Go', '#4fa6b4');
    defineFileType('sql db sqlite', 'database', 'DB', '#b29855');
    defineFileType('zip gz tar rar 7z tgz', 'archive', 'Zip', '#af966c');
    defineFileType('txt log csv', 'text', 'Text', '#8d99a6');
    const DEFAULT_FILE_ICON = Object.freeze({ kind: 'file', label: 'File', color: 'currentColor' });
    const PACKAGE_ICON = Object.freeze({ kind: 'npm', label: 'npm', color: '#cf6c68' });
    const GIT_ICON = Object.freeze({ kind: 'git', label: 'Git', color: '#d57d61' });
    const DOCKER_ICON = Object.freeze({ kind: 'docker', label: 'Docker', color: '#439ed0' });

    function getFileIcon(path) {
      if (typeof path !== 'string') return DEFAULT_FILE_ICON;
      const name = path.replace(/\\/g, '/').split('/').pop().toLowerCase();
      if (name === 'package.json' || name === 'package-lock.json' || name === 'pnpm-lock.yaml' || name === 'yarn.lock') return PACKAGE_ICON;
      if (name === '.gitignore' || name === '.gitattributes' || name === '.gitmodules') return GIT_ICON;
      if (name === 'dockerfile' || name.startsWith('dockerfile.') || name === '.dockerignore') return DOCKER_ICON;
      const dot = name.lastIndexOf('.');
      return dot > 0 ? FILE_TYPES.get(name.slice(dot + 1)) ?? DEFAULT_FILE_ICON : DEFAULT_FILE_ICON;
    }

    function FileIcon({ path }) {
      const icon = getFileIcon(path);
      const svg = {
        width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none',
        'aria-hidden': true, focusable: false, 'data-file-icon': icon.kind,
        style: { display: 'block', flex: '0 0 16px', color: icon.color, pointerEvents: 'none' },
      };
      const title = h('title', null, icon.label);
      if (icon.kind === 'react') {
        return h('svg', svg, title,
          ...[0, 60, 120].map((angle) => h('ellipse', { key: angle, cx: 10, cy: 10, rx: 8, ry: 3, stroke: 'currentColor', strokeWidth: 1.3, transform: `rotate(${angle} 10 10)` })),
          h('circle', { cx: 10, cy: 10, r: 1.5, fill: 'currentColor' }));
      }
      if (icon.kind === 'image') {
        return h('svg', svg, title,
          h('rect', { x: 2, y: 3, width: 16, height: 14, rx: 2, stroke: 'currentColor', strokeWidth: 1.5 }),
          h('circle', { cx: 6.5, cy: 7, r: 1.5, fill: 'currentColor' }),
          h('path', { d: 'm3 15 5-5 3 3 3-4 4 6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }));
      }
      if (icon.kind === 'file' || icon.kind === 'text') {
        return h('svg', svg, title,
          h('path', { d: 'M5 2.5h6l4 4v11H5z M11 2.5v4h4 M7.5 10h5 M7.5 13h5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round', opacity: 0.8 }));
      }
      const shortLabel = icon.kind === 'docker' ? 'D' : icon.kind === 'archive' ? 'Z' : icon.kind === 'git' ? 'git' : icon.label;
      return h('svg', svg, title,
        h('rect', { x: 1, y: 1, width: 18, height: 18, rx: icon.kind === 'csharp' ? 5 : 3, fill: 'currentColor', fillOpacity: 0.13 }),
        h('rect', { x: 1.5, y: 1.5, width: 17, height: 17, rx: icon.kind === 'csharp' ? 4.5 : 2.5, stroke: 'currentColor', strokeOpacity: 0.45 }),
        h('text', { x: 10, y: 10.5, textAnchor: 'middle', dominantBaseline: 'middle', fill: 'currentColor', fontFamily: 'system-ui, sans-serif', fontSize: shortLabel.length > 2 ? 7 : 9, fontWeight: 750 }, shortLabel));
    }
    //#endregion

    //#region stores
    /** Minimal snapshot store: enough for a slot hook and for React. */
    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        getSnapshot() {
          return state;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          state = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    const summaries = createStore({});
    const rulesStore = createStore({ status: 'loading', rules: EMPTY_RULES, error: null });
    const inflight = new Map();

    async function loadSummary(sessionId, seq) {
      const key = summaryKey(sessionId, seq);
      const state = summaries.getSnapshot();
      if (state[key] !== undefined && state[key] !== 'error') return;
      if (inflight.has(key)) return;
      const task = (async () => {
        try {
          const response = await fetch(summaryUrl(sessionId, seq));
          if (!response.ok) {
            summaries.set({ ...summaries.getSnapshot(), [key]: 'missing' });
            return;
          }
          const value = await response.json();
          const valid = value !== null
            && typeof value === 'object'
            && Array.isArray(value.files)
            && typeof value.turn === 'number';
          summaries.set({ ...summaries.getSnapshot(), [key]: valid ? value : 'missing' });
        } catch {
          summaries.set({ ...summaries.getSnapshot(), [key]: 'error' });
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, task);
      await task;
    }

    async function loadRules() {
      try {
        const response = await fetch(RULES_ROUTE, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.json();
        // A legacy running Host would silently discard noiseDirs on PUT.
        // Require the normalized new wire shape before enabling rule editing.
        if (!Array.isArray(value?.noiseDirs)) throw new Error('rules host needs reload');
        rulesStore.set({ status: 'ready', rules: normalizeIncoming(value), error: null });
      } catch (error) {
        rulesStore.set({ status: 'error', rules: EMPTY_RULES, error: String(error?.message ?? error) });
      }
    }

    async function saveRules(rules) {
      const response = await fetch(RULES_ROUTE, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rules),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const saved = normalizeIncoming(await response.json());
      rulesStore.set({ status: 'ready', rules: saved, error: null });
      return saved;
    }

    /** Client-side twin of normalizeRules: defensively accept whatever the Host answered. */
    function normalizeIncoming(input) {
      const clean = (list, normalize) => {
        if (!Array.isArray(list)) return [];
        const out = [];
        for (const item of list) {
          if (typeof item !== 'string') continue;
          const value = normalize(item);
          if (value === '' || value === '.' || value.length > 200) continue;
          if (!out.includes(value)) out.push(value);
          if (out.length >= 200) break;
        }
        return out.sort();
      };
      if (input === null || typeof input !== 'object' || Array.isArray(input)) input = {};
      return {
        dirs: clean(input.dirs, (v) => v.replace(/\\/g, '/').trim().replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()),
        exts: clean(input.exts, (v) => {
          const text = v.trim().toLowerCase();
          if (text === '' || text === '.') return '';
          return text.startsWith('.') ? text : `.${text}`;
        }),
        noiseDirs: clean(input.noiseDirs === undefined ? ['.agent-tmp'] : input.noiseDirs, (value) => {
          const name = value.trim().toLowerCase();
          return name === '..' || /[\\/<>:"|?*\x00-\x1f]/.test(name) ? '' : name;
        }),
      };
    }

    function clearAll() {
      inflight.clear();
      summaries.set({});
    }

    /**
     * Open the shipped review surface through the sidebar service.
     * Returns false when that service is unavailable so the caller can fall back
     * to opening the plain file; `sidebarRight` stays an optional dependency.
     */
    function openReview(ctx, coordinates, index) {
      const sidebar = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : undefined;
      if (sidebar === undefined || sidebar === null || typeof sidebar.openResource !== 'function') return false;
      const address = `dsh-resource://changes-review/session/${encodeURIComponent(coordinates.sessionId)}/${coordinates.seq}/${coordinates.turn}`;
      if (index === undefined) sidebar.openResource(address);
      else sidebar.openResource(address, { params: { index } });
      return true;
    }
    //#endregion

    //#region styles
    const S = {
      root: { display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0', fontSize: 12, lineHeight: 1.5 },
      header: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      title: { fontWeight: 600, opacity: 0.9 },
      spacer: { flex: 1 },
      segment: { display: 'inline-flex', border: '1px solid currentColor', borderRadius: 6, overflow: 'hidden', opacity: 0.9 },
      segmentButton: { border: 0, background: 'transparent', color: 'inherit', font: 'inherit', padding: '1px 8px', cursor: 'pointer', opacity: 0.7 },
      segmentActive: { opacity: 1, background: 'color-mix(in srgb, currentColor 14%, transparent)', fontWeight: 600 },
      iconButton: { border: 0, background: 'transparent', color: 'inherit', font: 'inherit', padding: '1px 6px', cursor: 'pointer', opacity: 0.7, borderRadius: 4 },
      group: { display: 'flex', flexDirection: 'column', gap: 2 },
      groupHeader: { display: 'flex', alignItems: 'baseline', gap: 6, opacity: 0.8, fontSize: 11, textTransform: 'none' },
      groupName: { fontWeight: 600 },
      row: { display: 'flex', alignItems: 'center', gap: 8, padding: '1px 6px', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', borderRadius: 4, width: '100%' },
      rowDim: { opacity: 0.5 },
      name: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      tag: { fontSize: 10, padding: '0 4px', borderRadius: 3, border: '1px solid currentColor', opacity: 0.6 },
      added: { color: 'inherit', opacity: 0.75, fontVariantNumeric: 'tabular-nums', fontSize: 11 },
      more: { border: 0, background: 'transparent', color: 'inherit', font: 'inherit', padding: '1px 6px', cursor: 'pointer', opacity: 0.65, fontSize: 11, textAlign: 'left' },
      note: { opacity: 0.65, fontSize: 11 },
      panel: { display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 8, padding: 8 },
      panelLabel: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, opacity: 0.85 },
      textarea: { width: '100%', minHeight: 54, boxSizing: 'border-box', font: 'inherit', fontSize: 11, padding: 6, borderRadius: 6, border: '1px solid color-mix(in srgb, currentColor 30%, transparent)', background: 'transparent', color: 'inherit', resize: 'vertical' },
      panelActions: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
      button: { font: 'inherit', fontSize: 11, padding: '2px 10px', borderRadius: 6, border: '1px solid color-mix(in srgb, currentColor 35%, transparent)', background: 'transparent', color: 'inherit', cursor: 'pointer' },
      presented: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 },
      presentedRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '1px 6px' },
    };
    //#endregion

    //#region components
    function Counts({ added, deleted }) {
      const parts = [];
      if (added > 0) parts.push(`+${added}`);
      if (deleted > 0) parts.push(`-${deleted}`);
      if (parts.length === 0) return null;
      return h('span', { style: S.added }, parts.join(' '));
    }

    function FileRow({ item, t, onOpen, onPreview }) {
      const tags = [];
      if (item.hidden) tags.push(h('span', { key: 'hidden', style: S.tag }, t(item.hiddenReason === 'noise' ? 'hidden.noise.tag' : 'hidden.manual.tag')));
      if (item.file.binary) tags.push(h('span', { key: 'binary', style: S.tag }, t('binary.tag')));
      if (item.file.oversized) tags.push(h('span', { key: 'oversized', style: S.tag }, t('oversized.tag')));
      // A refused snapshot is not an empty diff. Keep its explanation and the
      // current-file action distinct; never present today's bytes as history.
      if (item.file.oversized === true) {
        return h('div', { 'data-diff-unavailable': 'oversized', style: item.hidden ? S.rowDim : undefined }, [
          h('div', { key: 'file', style: { ...S.row, cursor: 'default', boxSizing: 'border-box' }, title: item.file.path }, [
            h(FileIcon, { key: 'icon', path: item.file.path ?? item.relative }),
            h('span', { key: 'name', style: S.name }, item.file.display ?? item.relative),
            ...tags,
            typeof onPreview === 'function' ? h('button', {
              key: 'current', type: 'button', style: { ...S.more, flexShrink: 0 },
              title: t('oversized.previewHint'), onClick: onPreview,
            }, t('action.viewCurrent')) : null,
          ]),
          h('div', { key: 'note', style: { ...S.note, padding: '0 6px 3px 30px' } }, t('oversized.note')),
        ]);
      }
      return h('button', {
        type: 'button',
        style: item.hidden ? { ...S.row, ...S.rowDim } : S.row,
        title: item.file.path,
        onClick: onOpen,
      }, h(FileIcon, { path: item.file.path ?? item.relative }), h('span', { style: S.name }, item.file.display ?? item.relative), tags, h(Counts, { added: item.added, deleted: item.deleted }));
    }

    function RulesPanel({ t, rules, onClose }) {
      const [dirs, setDirs] = React.useState(rules.dirs.join('\n'));
      const [exts, setExts] = React.useState(rules.exts.join('\n'));
      const [noiseDirs, setNoiseDirs] = React.useState((rules.noiseDirs ?? ['.agent-tmp']).join('\n'));
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      async function submit() {
        setBusy(true);
        setError(null);
        try {
          await saveRules({ dirs: parseLines(dirs), exts: parseLines(exts), noiseDirs: parseLines(noiseDirs) });
          onClose();
        } catch (failure) {
          setError(String(failure?.message ?? failure));
        } finally {
          setBusy(false);
        }
      }
      return h('div', { style: S.panel }, [
        h('label', { key: 'dirs', style: S.panelLabel }, [
          h('span', { key: 'label' }, t('rules.dirs')),
          h('textarea', {
            key: 'input',
            style: S.textarea,
            value: dirs,
            spellCheck: false,
            placeholder: 'docs\nres/Atlas',
            onChange: (event) => setDirs(event.target.value),
          }),
        ]),
        h('label', { key: 'exts', style: S.panelLabel }, [
          h('span', { key: 'label' }, t('rules.exts')),
          h('textarea', {
            key: 'input',
            style: S.textarea,
            value: exts,
            spellCheck: false,
            placeholder: '.meta\n.png',
            onChange: (event) => setExts(event.target.value),
          }),
        ]),
        h('label', { key: 'noise', style: S.panelLabel }, [
          h('span', { key: 'label' }, t('rules.noiseDirs')),
          h('textarea', { key: 'input', style: S.textarea, value: noiseDirs, spellCheck: false, placeholder: '.agent-tmp', onChange: (event) => setNoiseDirs(event.target.value) }),
          h('span', { key: 'hint', style: S.note }, t('rules.noiseHint')),
        ]),
        error === null ? null : h('span', { key: 'error', style: S.note }, t('rules.saveFailed', { message: error })),
        h('div', { key: 'actions', style: S.panelActions }, [
          h('button', {
            key: 'clear',
            type: 'button',
            style: S.button,
            disabled: busy,
            onClick: () => {
              setDirs('');
              setExts('');
            },
          }, t('action.clear')),
          h('button', { key: 'cancel', type: 'button', style: S.button, disabled: busy, onClick: onClose }, t('action.cancel')),
          h('button', { key: 'save', type: 'button', style: S.button, disabled: busy, onClick: submit }, busy ? t('rules.saving') : t('action.save')),
        ]),
      ]);
    }
    //#endregion

    //#region the replacing card
    function FilteredDeliverablesTail(props) {
      const { sessionId, turn, t, openFile, useChangesSummary, loadChangesSummary, openChangesReview } = props;
      const data = turn !== null && turn !== undefined && turn.data !== undefined && typeof turn.data.get === 'function'
        ? turn.data.get('deliverables')
        : null;
      const announced = data !== null && data !== undefined && data.changes !== undefined ? data.changes : null;
      const presented = dedupePresented(data, typeof props.seq === 'number' ? props.seq : undefined);

      const [showAll, setShowAll] = React.useState(false);
      const [rulesOpen, setRulesOpen] = React.useState(false);
      const [expandedGroups, setExpandedGroups] = React.useState({});
      const [presentedExpanded, setPresentedExpanded] = React.useState(false);
      const rulesState = React.useSyncExternalStore(rulesStore.subscribe, rulesStore.getSnapshot);

      const summary = useChangesSummary((value) => (announced === null ? undefined : value[summaryKey(sessionId, announced.seq)]));
      React.useEffect(() => {
        if (announced !== null && summary === undefined) loadChangesSummary(sessionId, announced.seq);
      }, [announced, summary, sessionId, loadChangesSummary]);

      const changes = announced !== null
        && summary !== undefined
        && summary !== 'loading'
        && summary !== 'missing'
        && summary !== 'error'
        && typeof summary === 'object'
        && Array.isArray(summary.files)
        && summary.files.length > 0
        ? { seq: announced.seq, ...summary }
        : null;

      if (changes === null && presented.length === 0) return null;

      const rules = rulesState.status === 'ready' ? rulesState.rules : EMPTY_RULES;
      const items = changes === null ? [] : changes.files.map((file, index) => {
        // `display` is already workspace-relative; `path` is the absolute fallback.
        const relative = relPath(file.display ?? file.path);
        const reason = hiddenReason(relative, rules);
        return {
          index,
          file,
          relative,
          added: typeof file.added === 'number' ? file.added : 0,
          deleted: typeof file.deleted === 'number' ? file.deleted : 0,
          hidden: reason !== null,
          hiddenReason: reason,
        };
      });
      const visible = items.filter((item) => !item.hidden);
      const hiddenCount = items.length - visible.length;
      const manualCount = items.filter((item) => item.hiddenReason === 'manual').length;
      const noiseCount = items.filter((item) => item.hiddenReason === 'noise').length;
      const displayed = showAll ? items : visible;
      const totals = displayed.reduce((sum, item) => ({ added: sum.added + item.added, deleted: sum.deleted + item.deleted }), { added: 0, deleted: 0 });
      const hiddenNote = () => h('span', { style: S.note }, [
        manualCount > 0 ? t('label.hiddenManual', { count: manualCount }) : null,
        manualCount > 0 && noiseCount > 0 ? ' · ' : null,
        noiseCount > 0 ? t('label.hiddenNoise', { count: noiseCount }) : null,
      ]);
      const groups = groupFiles(visible, { root: t('group.root'), external: t('group.external') });
      const openIndex = (item) => {
        if (changes === null) return;
        const opened = openChangesReview({ sessionId, seq: changes.seq, turn: changes.turn }, item.index);
        if (opened !== true && typeof openFile === 'function') openFile(item.file.path);
      };

      const sections = [];

      if (changes !== null) {
        sections.push(h('div', { key: 'header', style: S.header }, [
          h('span', { key: 'title', style: S.title }, t('label.changed')),
          h(Counts, { key: 'delta', added: totals.added, deleted: totals.deleted }),
          h('span', { key: 'count', style: S.note }, t('label.shown', { shown: displayed.length, total: items.length })),
          h('span', { key: 'spacer', style: S.spacer }),
          h('div', { key: 'segment', style: S.segment }, [
            h('button', {
              key: 'filtered',
              type: 'button',
              style: showAll ? S.segmentButton : { ...S.segmentButton, ...S.segmentActive },
              onClick: () => setShowAll(false),
            }, t('view.filtered')),
            h('button', {
              key: 'all',
              type: 'button',
              style: showAll ? { ...S.segmentButton, ...S.segmentActive } : S.segmentButton,
              onClick: () => setShowAll(true),
            }, t('view.all')),
          ]),
          h('button', {
            key: 'rules',
            type: 'button',
            style: S.iconButton,
            title: t('action.rules'),
            'aria-label': t('action.rules'),
            onClick: () => setRulesOpen((value) => !value),
          }, '\u2699'),
          h('button', {
            key: 'review',
            type: 'button',
            style: S.iconButton,
            onClick: () => openChangesReview({ sessionId, seq: changes.seq, turn: changes.turn }),
          }, t('action.review')),
        ]));

        if (rulesOpen && rulesState.status === 'ready') {
          sections.push(h(RulesPanel, {
            key: 'rules',
            t,
            rules,
            onClose: () => setRulesOpen(false),
          }));
        } else if (rulesState.status === 'error') {
          sections.push(h('span', { key: 'rules-error', style: S.note }, t('rules.unavailable')));
        }

        if (showAll) {
          const rows = items.map((item) => h(FileRow, { key: item.index, item, t, onOpen: () => openIndex(item), onPreview: typeof openFile === 'function' ? () => openFile(item.file.path) : undefined }));
          sections.push(h('div', { key: 'all', style: S.group }, rows));
          if (hiddenCount > 0) {
            sections.push(h('div', { key: 'hidden-note' }, hiddenNote()));
          }
        } else if (visible.length === 0) {
          sections.push(h('div', { key: 'empty', style: S.group }, [
            h('span', { key: 'text', style: S.note }, t('empty.allHidden', { count: items.length })),
            hiddenNote(),
            h('button', { key: 'rules', type: 'button', style: S.more, onClick: () => setRulesOpen(true) }, t('action.rules')),
            h('button', {
              key: 'open',
              type: 'button',
              style: S.more,
              onClick: () => setShowAll(true),
            }, t('action.showAll')),
          ]));
        } else {
          const blocks = groups.map((group) => {
            const expanded = expandedGroups[group.id] === true;
            const shown = expanded ? group.files : group.files.slice(0, COLLAPSED_ROWS);
            const children = [
              h('div', { key: 'header', style: S.groupHeader }, [
                h('span', { key: 'name', style: S.groupName }, group.label),
                h('span', { key: 'count' }, t('label.files', { count: group.files.length })),
                h(Counts, { key: 'delta', added: group.added, deleted: group.deleted }),
              ]),
              ...shown.map((item) => h(FileRow, { key: item.index, item, t, onOpen: () => openIndex(item), onPreview: typeof openFile === 'function' ? () => openFile(item.file.path) : undefined })),
            ];
            if (group.files.length > COLLAPSED_ROWS) {
              children.push(h('button', {
                key: 'more',
                type: 'button',
                style: S.more,
                onClick: () => setExpandedGroups((value) => ({ ...value, [group.id]: !expanded })),
              }, expanded ? t('action.collapse') : t('action.expand', { count: group.files.length - COLLAPSED_ROWS })));
            }
            return h('div', { key: group.id, style: S.group }, children);
          });
          sections.push(h('div', { key: 'groups', style: { display: 'flex', flexDirection: 'column', gap: 6 } }, blocks));
          if (hiddenCount > 0) {
            sections.push(h('div', { key: 'hidden-note' }, hiddenNote()));
          }
        }
      }

      if (presented.length > 0) {
        const expanded = presentedExpanded || presented.length <= COLLAPSED_PRESENTED;
        const shown = expanded ? presented : presented.slice(0, COLLAPSED_PRESENTED);
        const rows = shown.map((file, index) => h('div', { key: `${file.seq ?? 0}:${file.index ?? index}`, style: S.presentedRow }, [
          h(FileIcon, { key: 'icon', path: file.path }),
          h('span', { key: 'name', style: S.name, title: file.path }, file.path),
          typeof openFile === 'function'
            ? h('button', {
              key: 'preview',
              type: 'button',
              style: S.more,
              onClick: () => openFile(file.path),
            }, t('presented.preview'))
            : null,
        ]));
        const children = [
          h('div', { key: 'title', style: S.groupHeader }, [
            h('span', { key: 'name', style: S.groupName }, t('presented.title')),
            h('span', { key: 'count' }, t('label.files', { count: presented.length })),
          ]),
          ...rows,
        ];
        if (presented.length > COLLAPSED_PRESENTED) {
          children.push(h('button', {
            key: 'more',
            type: 'button',
            style: S.more,
            onClick: () => setPresentedExpanded((value) => !value),
          }, expanded ? t('action.collapse') : t('action.expand', { count: presented.length - COLLAPSED_PRESENTED })));
        }
        sections.push(h('div', { key: 'presented', style: S.presented }, children));
      }

      return h('div', { style: S.root, 'data-changes-filter': true }, sections);
    }
    //#endregion

    //#region locale
    const zh = {
      'label.changed': '本轮改动',
      'label.files': '{count} 个文件',
      'label.hidden': '已按规则隐藏 {count} 个',
      'label.shown': '显示 {shown} / 共 {total} 个文件',
      'label.hiddenManual': '手动规则隐藏 {count} 个',
      'label.hiddenNoise': '过程目录隐藏 {count} 个',
      'hidden.manual.tag': '手动规则',
      'hidden.noise.tag': '过程产物目录',
      'rules.noiseDirs': '过程产物目录名（每行一个，按完整目录段匹配）',
      'rules.noiseHint': '默认 .agent-tmp；支持嵌套与外部路径。留空关闭；不支持路径或通配符。',
      'view.filtered': '过滤后',
      'view.all': '全部',
      'action.rules': '过滤规则',
      'action.review': '审阅',
      'action.expand': '展开 {count} 个',
      'action.collapse': '收起',
      'action.showAll': '查看全部',
      'action.save': '保存',
      'action.cancel': '取消',
      'action.clear': '清空手动排除',
      'rules.dirs': '文件夹（每行一个，按前缀匹配）',
      'rules.exts': '后缀（每行一个，如 .meta）',
      'rules.saving': '保存中…',
      'rules.saveFailed': '保存失败：{message}',
      'rules.unavailable': '过滤规则读取失败，当前显示全部文件且暂停编辑。若刚更新插件，请重载插件宿主。',
      'hidden.tag': '已过滤',
      'binary.tag': '二进制',
      'oversized.tag': '差异不可用',
      'action.viewCurrent': '查看当前文件',
      'oversized.previewHint': '打开当前文件，不是本轮历史差异',
      'oversized.note': '文件超出快照或对比上限，本轮差异不可用。查看当前文件不代表历史差异；调高上限不会补回未采集的历史版本。',
      'empty.allHidden': '本轮 {count} 个改动都被规则隐藏',
      'group.root': '根目录',
      'group.external': '外部路径',
      'presented.title': '交付文件',
      'presented.preview': '预览',
    };

    const en = {
      'label.changed': 'Changed',
      'label.files': '{count} files',
      'label.hidden': '{count} hidden by rules',
      'label.shown': 'Showing {shown} / {total} files',
      'label.hiddenManual': '{count} hidden by manual rules',
      'label.hiddenNoise': '{count} hidden by process directories',
      'hidden.manual.tag': 'manual rule',
      'hidden.noise.tag': 'process directory',
      'rules.noiseDirs': 'Process directory names (one complete segment per line)',
      'rules.noiseHint': 'Default: .agent-tmp. Includes nested and external paths. Leave empty to disable; no paths or wildcards.',
      'view.filtered': 'Filtered',
      'view.all': 'All',
      'action.rules': 'Filter rules',
      'action.review': 'Review',
      'action.expand': 'Show {count} more',
      'action.collapse': 'Collapse',
      'action.showAll': 'Show all',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.clear': 'Clear manual exclusions',
      'rules.dirs': 'Folders (one per line, prefix match)',
      'rules.exts': 'Extensions (one per line, e.g. .meta)',
      'rules.saving': 'Saving…',
      'rules.saveFailed': 'Save failed: {message}',
      'rules.unavailable': 'Filter rules unavailable; showing every file with editing paused. Reload the plugin host if you just upgraded.',
      'hidden.tag': 'hidden',
      'binary.tag': 'binary',
      'oversized.tag': 'diff unavailable',
      'action.viewCurrent': 'View current file',
      'oversized.previewHint': 'Open the current file, not this turn\'s historical diff',
      'oversized.note': 'The file exceeds the snapshot or comparison limit. Its turn diff is unavailable. The current file is not a historical diff; raising the limit cannot restore versions that were never captured.',
      'empty.allHidden': 'All {count} changes are hidden by the rules',
      'group.root': 'repository root',
      'group.external': 'outside workspace',
      'presented.title': 'Delivered files',
      'presented.preview': 'Preview',
    };
    //#endregion

    function apply(ctx) {
      // Register this plugin's dictionaries with the single-locale overload.
      ctx.effect(() => {
        const disposers = [
          ctx.locale.register(NS, 'zh', zh),
          ctx.locale.register(NS, 'en', en),
        ];
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, 'dsh-changes-filter: dictionaries');
      ctx.on('connection/reset', () => {
        clearAll();
        void loadRules();
      });
      void loadRules();

      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: INTERNAL_ID,
        // List cells shadow by priority, not registration order. Native is 0;
        // keep it alive underneath so disposal restores the original card.
        priority: -1,
        locale: NS,
        inject: () => ({
          hooks: { changesSummary: summaries },
          loadChangesSummary: (sessionIdOfTurn, seq) => loadSummary(sessionIdOfTurn, seq),
          openChangesReview: (coordinates, index) => openReview(ctx, coordinates, index),
        }),
      }, FilteredDeliverablesTail));
    }

    return {
      inject: ['slots', 'locale'],
      apply,
      __internals: { rulesStore, hiddenReason, relPath, isHidden, groupFiles, summaryKey, parseLines, normalizeIncoming, dedupePresented, getFileIcon, FileIcon, FileRow, FilteredDeliverablesTail },
    };
  },
});
