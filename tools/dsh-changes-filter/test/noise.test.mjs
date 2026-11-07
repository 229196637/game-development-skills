import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as host from '../lib/rules.js';

/** Reuse the existing React element-tree VM convention without DOM/network/profile access. */
function loadClient({ showAll = false, status = 'ready', rules = host.normalizeRules({}) } = {}) {
  let client;
  let stateIndex = 0;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.flat(Infinity) } };
    },
    useState(initial) {
      return [stateIndex++ === 0 ? showAll : typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect() {},
    useSyncExternalStore(subscribe, getSnapshot) { return getSnapshot(); },
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(descriptor) {
      client = descriptor.factory((id) => {
        assert.equal(id, 'react');
        return React;
      });
    } } },
  });
  vm.runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context);
  const internals = client.__internals;
  assert.ok(internals.rulesStore, 'expose rulesStore to exercise actual loading/error snapshots');
  internals.rulesStore.set({ status, rules, error: status === 'error' ? 'offline' : null });
  return internals;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
function descendants(node) {
  if (node === null || typeof node !== 'object') return [];
  return [node, ...(node.props?.children ?? []).flatMap(descendants)];
}
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (node.props?.children ?? []).map(text).join('');
}

for (const side of ['host', 'client']) {
  function helpers() {
    if (side === 'host') return { normalize: host.normalizeRules, ...host };
    const client = loadClient();
    return { normalize: client.normalizeIncoming, ...client };
  }

  test(`${side}: legacy/default and explicit disabled noise rules normalize to the complete schema`, () => {
    const { normalize } = helpers();
    const defaults = { dirs: [], exts: [], noiseDirs: ['.agent-tmp'] };
    for (const value of [undefined, null, 'invalid', [], {}, { dirs: [], exts: [] }]) {
      assert.deepEqual(plain(normalize(value)), defaults);
    }
    assert.deepEqual(plain(normalize({ noiseDirs: [] })), { dirs: [], exts: [], noiseDirs: [] });
  });

  test(`${side}: noise names are trimmed lowercase unique directory names with Windows-invalid input rejected`, () => {
    const { normalize } = helpers();
    const noiseDirs = [' Scratch ', 'SCRATCH', '.AGENT-TMP', '', ' ', '.', '..', 'nested/path', 'nested\\path',
      '<bad', '>bad', ':bad', '"bad', '|bad', '?bad', '*bad', null, 42, {}, 'x'.repeat(201)];
    assert.deepEqual(plain(normalize({ noiseDirs }).noiseDirs), ['.agent-tmp', 'scratch']);
    assert.deepEqual(plain(normalize({ noiseDirs: ['x'.repeat(200)] }).noiseDirs), ['x'.repeat(200)]);
    const many = Array.from({ length: 240 }, (_, i) => `noise-${String(i).padStart(3, '0')}`);
    assert.deepEqual(plain(normalize({ noiseDirs: many }).noiseDirs), many.slice(0, 200));
    for (const key of ['dirs', 'exts']) {
      assert.equal(normalize({ [key]: many })[key].length, 200, `${key} also keeps the host/client cap`);
      assert.equal(normalize({ [key]: ['x'.repeat(201)] })[key].length, 0, `${key} rejects overlong values`);
    }
  });

  test(`${side}: noise matches exact directory segments, including nested/absolute/tilde/backslash paths`, () => {
    const { hiddenReason, isHidden, normalize } = helpers();
    assert.equal(typeof hiddenReason, 'function');
    const rules = normalize({ noiseDirs: ['.agent-tmp', 'Scratch'] });
    const hidden = ['.agent-tmp/check.py', 'nested/.agent-tmp/task/reports/check.json', './.AGENT-TMP/a.cs',
      'D:\\Work\\.Agent-Tmp\\task\\check.ps1', '/tmp/project/.agent-tmp/report.md', '~/project/.agent-tmp/check.sh',
      'src/SCRATCH/results.txt'];
    const visible = ['.agent-tmp', 'src/.agent-tmp', 'src/scratch', '.agent-tmp2/check.py', 'my.agent-tmp/check.py',
      'src/.agent-tmp.json', 'src/not-scratch/check.ps1', 'scripts/verify.ps1', 'tools/check.py',
      'test/noise.test.mjs', 'src/verification.ts', 'docs/check-results.md', 'src/check.log', 'tmp/report.json'];
    for (const file of hidden) {
      assert.equal(hiddenReason(file, rules), 'noise', file);
      assert.equal(isHidden(file, rules), true, file);
    }
    for (const file of [...visible, '', undefined, null, 42]) {
      assert.equal(hiddenReason(file, rules), null, String(file));
      assert.equal(isHidden(file, rules), false, String(file));
    }
    assert.equal(hiddenReason('.agent-tmp/a.py', normalize({ noiseDirs: [] })), null);
  });

  test(`${side}: manual directory/extension matches take precedence and retain old prefix semantics`, () => {
    const { hiddenReason, isHidden, normalize } = helpers();
    const rules = normalize({ dirs: ['docs'], exts: ['meta'] });
    for (const file of ['docs', 'docs/a.md', 'DOCS/.agent-tmp/a.py', '.agent-tmp/cache.META']) {
      assert.equal(hiddenReason(file, rules), 'manual', file);
      assert.equal(isHidden(file, rules), true, file);
    }
    assert.equal(hiddenReason('docs2/a.md', rules), null);
    assert.equal(hiddenReason('nested/docs/a.md', rules), null);
    assert.equal(hiddenReason('src/a.meta.bak', rules), null);
    assert.equal(hiddenReason('nested/.agent-tmp/a.py', rules), 'noise');
  });
}

const files = [
  { path: 'D:/workspace/docs/.agent-tmp/manual.md', display: 'docs/.agent-tmp/manual.md', added: 100, deleted: 20 },
  { path: 'D:/workspace/Zulu/verify.ps1', display: 'Zulu/verify.ps1', added: 2, deleted: 1 },
  { path: 'D:/workspace/Alpha/.AGENT-TMP/task/log.json', display: 'Alpha/.AGENT-TMP/task/log.json', added: 50, deleted: 10 },
  { path: 'D:/workspace/Alpha/check.py', display: 'Alpha/check.py', added: 3, deleted: 2 },
  { path: 'D:/workspace/Zulu/foo.meta', display: 'Zulu/foo.meta', added: 7, deleted: 4 },
  { path: 'D:/workspace/Alpha/.agent-tmp2/real.ts', display: 'Alpha/.agent-tmp2/real.ts', added: 4, deleted: 0 },
  { path: 'D:\\outside\\.agent-tmp\\task\\result.txt', added: 9, deleted: 8 },
];

function renderTail(options = {}) {
  const rules = host.normalizeRules({ dirs: ['docs'], exts: ['.meta'] });
  const internals = loadClient({ rules, ...options });
  const calls = [];
  const reviews = [];
  const t = (key, args) => { calls.push({ key, args }); return key; };
  const summary = { files, turn: 5, added: 175, deleted: 45 };
  const root = internals.FilteredDeliverablesTail({
    sessionId: 'noise-test', seq: 10, t,
    turn: { data: { get: () => ({ changes: { seq: 9 } }) } },
    useChangesSummary(select) { return select({ 'noise-test:9': summary }); },
    loadChangesSummary() { assert.fail('supplied summary should not reload'); },
    openChangesReview(coordinates, index) { reviews.push({ ...coordinates, index }); return true; },
  });
  const header = root.props.children.find((node) => node?.props?.key === 'header');
  const delta = header.props.children.find((node) => node?.props?.key === 'delta');
  const rows = descendants(root).filter((node) => node.type === internals.FileRow);
  return { internals, root, header, delta, rows, calls, reviews, t };
}

function translation(rendered, key) { return rendered.calls.filter((call) => call.key === key).map((call) => plain(call.args)); }

test('filtered UI uses visible deltas/shown-total, exact reason counts and original review indices', () => {
  const rendered = renderTail();
  assert.deepEqual(plain(rendered.rows.map((row) => row.props.item.index)), [3, 5, 1]);
  assert.equal(rendered.delta.props.added, 9);
  assert.equal(rendered.delta.props.deleted, 3);
  assert.deepEqual(translation(rendered, 'label.shown'), [{ shown: 3, total: 7 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenManual'), [{ count: 2 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenNoise'), [{ count: 2 }]);
  for (const row of rendered.rows) {
    assert.equal(row.props.item.hidden, false);
    assert.equal(row.props.item.hiddenReason, null);
    row.props.onOpen();
  }
  assert.deepEqual(rendered.reviews.map((entry) => entry.index), [3, 5, 1]);
  assert.ok(rendered.reviews.every((entry) => entry.sessionId === 'noise-test' && entry.seq === 9 && entry.turn === 5));
});

test('all UI retains original order/total statistics and emits separate manual/noise row tags', () => {
  const rendered = renderTail({ showAll: true });
  assert.deepEqual(plain(rendered.rows.map((row) => row.props.item.index)), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(rendered.delta.props.added, 175);
  assert.equal(rendered.delta.props.deleted, 45);
  assert.deepEqual(translation(rendered, 'label.shown'), [{ shown: 7, total: 7 }]);
  assert.deepEqual(plain(rendered.rows.map((row) => row.props.item.hiddenReason)), ['manual', null, 'noise', null, 'manual', null, 'noise']);
  for (const node of rendered.rows) {
    const item = node.props.item;
    assert.equal(item.hidden, item.hiddenReason !== null);
    const row = rendered.internals.FileRow(node.props);
    if (item.hiddenReason !== null) {
      assert.ok(text(row).includes(`hidden.${item.hiddenReason}.tag`), 'row must identify why it was hidden');
      const other = item.hiddenReason === 'manual' ? 'noise' : 'manual';
      assert.ok(!text(row).includes(`hidden.${other}.tag`));
    } else {
      assert.ok(!text(row).includes('hidden.manual.tag'));
      assert.ok(!text(row).includes('hidden.noise.tag'));
    }
    row.props.onClick();
  }
  assert.deepEqual(rendered.reviews.map((entry) => entry.index), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(translation(rendered, 'label.hiddenManual'), [{ count: 2 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenNoise'), [{ count: 2 }]);
});

test('explicitly disabling noise in ready rules keeps process paths visible without disabling manual rules', () => {
  const rules = host.normalizeRules({ dirs: ['docs'], exts: ['meta'], noiseDirs: [] });
  const rendered = renderTail({ rules });
  assert.deepEqual(plain(rendered.rows.map((row) => row.props.item.index)).sort((a, b) => a - b), [1, 2, 3, 5, 6]);
  assert.equal(rendered.delta.props.added, 68);
  assert.equal(rendered.delta.props.deleted, 21);
  assert.deepEqual(translation(rendered, 'label.shown'), [{ shown: 5, total: 7 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenManual'), [{ count: 2 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenNoise'), []);
});

test('all-hidden filtered UI shows zero deltas and explains both reasons without losing access to all files', () => {
  const rules = host.normalizeRules({ dirs: ['docs', 'alpha', 'zulu'] });
  const rendered = renderTail({ rules });
  assert.equal(rendered.rows.length, 0);
  assert.equal(rendered.delta.props.added, 0);
  assert.equal(rendered.delta.props.deleted, 0);
  assert.deepEqual(translation(rendered, 'label.shown'), [{ shown: 0, total: 7 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenManual'), [{ count: 6 }]);
  assert.deepEqual(translation(rendered, 'label.hiddenNoise'), [{ count: 1 }]);
  assert.deepEqual(translation(rendered, 'empty.allHidden'), [{ count: 7 }]);
  assert.ok(descendants(rendered.root).some((node) => node.type === 'button' && text(node) === 'action.showAll'));
});

test('loading and failed rules fail open even if snapshot contains stale manual/default noise rules', () => {
  for (const status of ['loading', 'error']) {
    const rendered = renderTail({ status });
    assert.equal(rendered.rows.length, files.length, status);
    for (const row of rendered.rows) {
      assert.equal(row.props.item.hidden, false, status);
      assert.equal(row.props.item.hiddenReason, null, status);
    }
    assert.equal(rendered.delta.props.added, 175, status);
    assert.equal(rendered.delta.props.deleted, 45, status);
    assert.deepEqual(translation(rendered, 'label.shown'), [{ shown: 7, total: 7 }]);
    assert.deepEqual(translation(rendered, 'label.hiddenManual'), []);
    assert.deepEqual(translation(rendered, 'label.hiddenNoise'), []);
  }
});
