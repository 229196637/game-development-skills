import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const clientUrl = new URL('../client.js', import.meta.url);
const t = (key) => key;

/** Isolated browser-module loader; no real React, DOM, network, or global mutation. */
function loadClient({ rules = { dirs: [], exts: [] }, showAll = false } = {}) {
  let client;
  let stateIndex = 0;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.flat(Infinity) } };
    },
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial;
      return [stateIndex++ === 0 ? showAll : value, () => {}];
    },
    useEffect() {},
    useSyncExternalStore() {
      return { status: 'ready', rules, error: null };
    },
  };
  const context = vm.createContext({
    window: {
      __ModuleLoader__: {
        load(descriptor) {
          assert.equal(descriptor.id, 'dsh-changes-filter');
          client = descriptor.factory((id) => {
            assert.equal(id, 'react', `unexpected module dependency: ${id}`);
            return React;
          });
        },
      },
    },
  });
  vm.runInContext(readFileSync(clientUrl, 'utf8'), context, { filename: clientUrl.pathname });
  assert.ok(client?.__internals, 'client must register and expose __internals');
  return client.__internals;
}

function descendants(node) {
  if (node === null || typeof node !== 'object') return [];
  return [node, ...(node.props?.children ?? []).flatMap(descendants)];
}

function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (node.props?.children ?? []).map(text).join('');
}

function previewButtons(row) {
  return descendants(row).filter((node) => node.type === 'button' && text(node) === 'action.viewCurrent');
}

function oversizedItem() {
  return {
    index: 7,
    file: {
      path: 'D:\\workspace\\Runtime\\Large.cs',
      display: 'FriendlyLabel.tsx',
      oversized: true,
      binary: true,
    },
    relative: 'Runtime/AnotherLabel.lua', hidden: true, added: 2, deleted: 1,
  };
}

function assertUnavailable(row) {
  assert.equal(row.type, 'div', 'oversized row is not a historical-diff button');
  assert.equal(row.props['data-diff-unavailable'], 'oversized');
  assert.equal(row.props.onClick, undefined, 'container must not open historical diff');
  assert.ok(text(row).includes('oversized.note'), 'explanation must be visible text');
}

test('oversized FileRow keeps icon/name/tags but exposes only an independent current-file preview', () => {
  const { FileRow, FileIcon } = loadClient();
  const item = oversizedItem();
  let historicalOpens = 0;
  let currentOpens = 0;
  const row = FileRow({ item, t, onOpen: () => historicalOpens++, onPreview: () => currentOpens++ });
  assertUnavailable(row);

  const icon = descendants(row).find((node) => node.type === FileIcon);
  assert.ok(icon, 'file icon remains visible');
  assert.equal(icon.props.path, item.file.path, 'icon uses original path, not display label');
  const mainLine = descendants(row).find((node) => node.props.children?.includes(icon));
  assert.equal(mainLine.props.children[0], icon, 'main display line starts with the icon');
  assert.notEqual(mainLine.type, 'button', 'main display line is not a review button');
  assert.equal(mainLine.props.onClick, undefined, 'main display line has no historical click action');
  for (const label of [item.file.display, 'hidden.tag', 'binary.tag', 'oversized.tag']) {
    assert.ok(text(mainLine).includes(label), `${label} remains on the main display line`);
  }

  const previews = previewButtons(row);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].props.type, 'button');
  assert.equal(descendants(row).filter((node) => node.type === 'button').length, 1, 'no historical-diff button remains');
  assert.ok(!descendants(previews[0]).includes(icon), 'preview does not wrap the main icon/name line');
  for (const node of descendants(row)) {
    if (typeof node.props.onClick === 'function') node.props.onClick();
  }
  assert.equal(currentOpens, 1, 'only the independent preview callback fires');
  assert.equal(historicalOpens, 0, 'no oversized-row action invokes onOpen');
});

test('oversized FileRow still explains unavailable diff without an onPreview callback', () => {
  const { FileRow } = loadClient();
  let historicalOpens = 0;
  const row = FileRow({ item: oversizedItem(), t, onOpen: () => historicalOpens++ });
  assertUnavailable(row);
  assert.equal(previewButtons(row).length, 0);
  assert.equal(descendants(row).filter((node) => node.type === 'button').length, 0);
  for (const node of descendants(row)) {
    if (typeof node.props.onClick === 'function') node.props.onClick();
  }
  assert.equal(historicalOpens, 0);
});

test('ordinary FileRow keeps its historical review button, including binary files', () => {
  const { FileRow, FileIcon } = loadClient();
  for (const binary of [false, true]) {
    for (const oversized of [undefined, false]) {
      const item = oversizedItem();
      item.file = { ...item.file, binary, oversized };
      let historicalOpens = 0;
      let currentOpens = 0;
      const onOpen = () => historicalOpens++;
      const row = FileRow({ item, t, onOpen, onPreview: () => currentOpens++ });
      assert.equal(row.type, 'button');
      assert.equal(row.props.type, 'button');
      assert.equal(row.props.onClick, onOpen);
      assert.equal(row.props.title, item.file.path);
      assert.equal(row.props['data-diff-unavailable'], undefined);
      assert.equal(row.props.children[0].type, FileIcon);
      assert.equal(row.props.children[0].props.path, item.file.path);
      assert.ok(text(row).includes(item.file.display));
      assert.equal(previewButtons(row).length, 0);
      assert.ok(!text(row).includes('oversized.note'));
      row.props.onClick();
      assert.equal(historicalOpens, 1);
      assert.equal(currentOpens, 0);
    }
  }
});

function renderTail({ openFile, showAll = false } = {}) {
  const internals = loadClient({ rules: { dirs: ['hidden'], exts: ['.meta'] }, showAll });
  const files = [
    { path: 'D:\\workspace\\hidden\\ignored.cs', display: 'hidden/ignored.cs' },
    { path: 'D:\\workspace\\Zulu\\first.cs', display: 'Zulu/first.cs' },
    { path: 'D:\\workspace\\Alpha\\large.cs', display: 'Alpha/friendly-name.tsx', oversized: true, binary: true },
    { path: 'D:\\workspace\\Alpha\\normal.bin', display: 'Alpha/normal.bin', binary: true },
    { path: 'D:\\workspace\\Zulu\\large.json', display: 'Zulu/large.json', oversized: true },
    { path: 'D:\\workspace\\Alpha\\ignored.meta', display: 'Alpha/ignored.meta' },
  ];
  const sessionId = 'oversized-integration';
  const seq = 17;
  const summary = { files, turn: 9, added: 5, deleted: 1 };
  const reviews = [];
  let selected;
  const root = internals.FilteredDeliverablesTail({
    sessionId, seq: 18, t, openFile,
    turn: { data: { get: (key) => key === 'deliverables' ? { changes: { seq } } : null } },
    useChangesSummary(select) {
      selected = select({ [`${sessionId}:${seq}`]: summary, [`${sessionId}:18`]: 'missing' });
      return selected;
    },
    loadChangesSummary() { assert.fail('a supplied summary must not require loading or preflight'); },
    openChangesReview(coordinates, index) {
      reviews.push({ coordinates: { ...coordinates }, index });
      return true;
    },
  });
  assert.equal(selected, summary, 'summary selector uses announced sessionId:seq, not closing-turn seq');
  const rows = descendants(root).filter((node) => node.type === internals.FileRow);
  return { ...internals, files, rows, reviews, coordinates: { sessionId, seq, turn: summary.turn } };
}

test('filtered sorted groups preserve original review indices and preview only original current paths', () => {
  const opened = [];
  const { FileRow, files, rows, reviews, coordinates } = renderTail({ openFile: (path) => opened.push(path) });
  assert.deepEqual(rows.map((node) => node.props.item.index), [2, 3, 1, 4], 'hidden indices are removed and Alpha sorts ahead of Zulu');
  assert.deepEqual(rows.map((node) => node.props.item.file.path), [files[2].path, files[3].path, files[1].path, files[4].path]);
  for (const node of rows) {
    assert.equal(typeof node.props.onPreview, 'function', 'openFile capability is passed to each FileRow');
    const row = FileRow(node.props);
    if (node.props.item.file.oversized === true) {
      assertUnavailable(row);
      const previews = previewButtons(row);
      assert.equal(previews.length, 1);
      previews[0].props.onClick();
      assert.equal(reviews.length, 0, 'preview never opens historical review');
    }
  }
  assert.deepEqual(opened, [files[2].path, files[4].path], 'previews use absolute original paths, never display labels');
  for (const node of rows.filter((entry) => entry.props.item.file.oversized !== true)) {
    FileRow(node.props).props.onClick();
  }
  assert.deepEqual(reviews, [{ coordinates, index: 3 }, { coordinates, index: 1 }]);
  assert.deepEqual(opened, [files[2].path, files[4].path], 'successful regular review does not fall back to preview');
});

test('all-files mode also wires oversized preview to the original current path', () => {
  const opened = [];
  const { FileRow, files, rows, reviews } = renderTail({ showAll: true, openFile: (path) => opened.push(path) });
  assert.deepEqual(rows.map((node) => node.props.item.index), [0, 1, 2, 3, 4, 5]);
  for (const node of rows.filter((entry) => entry.props.item.file.oversized === true)) {
    const row = FileRow(node.props);
    assertUnavailable(row);
    const previews = previewButtons(row);
    assert.equal(previews.length, 1);
    previews[0].props.onClick();
  }
  assert.deepEqual(opened, [files[2].path, files[4].path]);
  assert.deepEqual(reviews, []);
});

test('tail passes no preview callback when openFile is not a function, in either view', () => {
  for (const showAll of [false, true]) {
    for (const openFile of [undefined, null, {}, 'not-a-function']) {
      const { FileRow, rows, reviews } = renderTail({ showAll, openFile });
      assert.ok(rows.length > 0);
      for (const node of rows) {
        assert.equal(node.props.onPreview, undefined, 'no wrapper callback without a callable openFile');
        if (node.props.item.file.oversized === true) {
          const row = FileRow(node.props);
          assertUnavailable(row);
          assert.equal(previewButtons(row).length, 0);
          assert.equal(descendants(row).filter((entry) => entry.type === 'button').length, 0);
        }
      }
      assert.deepEqual(reviews, []);
    }
  }
});
