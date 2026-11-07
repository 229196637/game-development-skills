import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const clientUrl = new URL('../client.js', import.meta.url);

/** Load the browser module in isolation without React, a DOM, or global mutations. */
function loadClient() {
  let client;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.flat(Infinity) } };
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect() {},
    useSyncExternalStore(_subscribe, getSnapshot) {
      return getSnapshot();
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
  assert.ok(client?.__internals, 'client must register its module and expose __internals');
  return client.__internals;
}

function descendants(node) {
  if (node === null || typeof node !== 'object') return [];
  return [node, ...(node.props?.children ?? []).flatMap(descendants)];
}

const extensionCases = [
  ['cs', 'csharp', 'C#'],
  ['js', 'javascript', 'JS'],
  ['mjs', 'javascript', 'JS'],
  ['cjs', 'javascript', 'JS'],
  ['jsx', 'react', 'JSX'],
  ['ts', 'typescript', 'TS'],
  ['mts', 'typescript', 'TS'],
  ['cts', 'typescript', 'TS'],
  ['tsx', 'react', 'TSX'],
  ['json', 'json', '{}'],
  ['css', 'css'],
  ['md', 'markdown'],
  ['py', 'python'],
  ['lua', 'lua'],
  ['shader', 'shader'],
  ['unity', 'unity'],
  ['prefab', 'unity'],
  ['asset', 'unity'],
  ['meta', 'unity'],
];

function assertIcon(getFileIcon, filePath, kind, label) {
  const icon = getFileIcon(filePath);
  assert.equal(icon.kind, kind, `${filePath}: icon kind`);
  if (label !== undefined) assert.equal(icon.label, label, `${filePath}: icon label`);
  assert.equal(typeof icon.label, 'string', `${filePath}: label is a string`);
  assert.ok(icon.label.trim(), `${filePath}: label is not empty`);
  assert.equal(typeof icon.color, 'string', `${filePath}: color is a string`);
  assert.ok(icon.color.trim(), `${filePath}: color is not empty`);
  return icon;
}

test('getFileIcon maps every supported extension, ignoring case and path separators', () => {
  const { getFileIcon } = loadClient();
  assert.equal(typeof getFileIcon, 'function');
  for (const [extension, kind, label] of extensionCases) {
    for (const filePath of [
      `sample.${extension}`,
      `/workspace/src/sample.${extension.toUpperCase()}`,
      `D:\\workspace\\src\\sample.${extension.toUpperCase()}`,
    ]) {
      assertIcon(getFileIcon, filePath, kind, label);
    }
  }
});

test('getFileIcon recognizes special basenames, with package.json taking precedence over JSON', () => {
  const { getFileIcon } = loadClient();
  for (const [basename, kind] of [
    ['Dockerfile', 'docker'],
    ['.gitignore', 'git'],
    ['package.json', 'npm'],
  ]) {
    for (const filePath of [basename, `/workspace/${basename.toUpperCase()}`, `D:\\workspace\\${basename.toUpperCase()}`]) {
      assertIcon(getFileIcon, filePath, kind);
    }
  }
  assertIcon(getFileIcon, '/workspace/config.json', 'json', '{}');
});

test('getFileIcon uses the basename rather than dotted or specially named directories', () => {
  const { getFileIcon } = loadClient();
  for (const filePath of [
    'README',
    'notes.unrecognized-extension',
    '/workspace.cs/README',
    'D:\\workspace.tsx\\README',
    '/workspace/package.json/notes.unknown',
    'D:\\workspace\\Dockerfile\\README',
    '/workspace/.gitignore/notes.unknown',
  ]) {
    assertIcon(getFileIcon, filePath, 'file');
  }
  assertIcon(getFileIcon, '/workspace.cs/component.tsx', 'react', 'TSX');
  assertIcon(getFileIcon, 'D:\\workspace.tsx\\main.cs', 'csharp', 'C#');
});

test('FileIcon renders a decorative 16px SVG with its kind and title label', () => {
  const { getFileIcon, FileIcon } = loadClient();
  assert.equal(typeof FileIcon, 'function');
  const paths = [
    ...extensionCases.map(([extension]) => `src/example.${extension}`),
    'Dockerfile', '.gitignore', 'package.json', 'README', 'unknown.weird',
  ];
  for (const filePath of paths) {
    const icon = getFileIcon(filePath);
    const svg = FileIcon({ path: filePath });
    assert.equal(svg.type, 'svg', `${filePath}: root element`);
    assert.equal(svg.props.width, 16, `${filePath}: width`);
    assert.equal(svg.props.height, 16, `${filePath}: height`);
    assert.equal(String(svg.props['aria-hidden']), 'true', `${filePath}: aria-hidden`);
    assert.equal(String(svg.props.focusable), 'false', `${filePath}: focusable`);
    assert.equal(svg.props['data-file-icon'], icon.kind, `${filePath}: data-file-icon`);
    const titles = descendants(svg).filter((node) => node.type === 'title');
    assert.equal(titles.length, 1, `${filePath}: one SVG title`);
    assert.equal(titles[0].props.children.join(''), icon.label, `${filePath}: title label`);
    assert.ok(descendants(svg).some((node) => ['path', 'rect', 'circle', 'polygon', 'polyline', 'line', 'text', 'use'].includes(node.type)), `${filePath}: SVG has visible geometry`);
  }
});

test('FileRow starts with FileIcon using file.path, not its display name', () => {
  const { FileIcon, FileRow } = loadClient();
  assert.equal(typeof FileRow, 'function');
  const onOpen = () => {};
  const item = {
    file: { path: 'D:\\workspace\\Runtime\\Player.cs', display: 'FriendlyLabel.tsx', binary: true, oversized: true },
    relative: 'AnotherLabel.lua', hidden: true, added: 2, deleted: 1,
  };
  const row = FileRow({ item, t: (key) => key, onOpen });
  assert.equal(row.type, 'button');
  assert.equal(row.props.children[0].type, FileIcon, 'icon must precede the filename and tags');
  assert.equal(row.props.children[0].props.path, item.file.path);
  assert.equal(row.props.title, item.file.path);
  assert.equal(row.props.onClick, onOpen, 'adding an icon must preserve opening the file');
  assert.ok(descendants(row).some((node) => node.type === 'span' && node.props.children.includes(item.file.display)), 'display name remains the visible label');
});

test('delivered-file rows also start with FileIcon using the original delivered path', () => {
  const { FileIcon, FilteredDeliverablesTail } = loadClient();
  assert.equal(typeof FilteredDeliverablesTail, 'function');
  const delivered = { path: 'D:\\workspace\\settings.json', display: 'FriendlyLabel.cs', seq: 1 };
  const opened = [];
  const root = FilteredDeliverablesTail({
    sessionId: 'icons-test', seq: 2,
    turn: { data: { get: (key) => key === 'deliverables' ? { presented: [delivered] } : null } },
    t: (key) => key,
    openFile: (filePath) => opened.push(filePath),
    useChangesSummary: (select) => select({}),
    loadChangesSummary() { throw new Error('presented-only rendering must not load changes'); },
    openChangesReview() {},
  });
  const icons = descendants(root).filter((node) => node.type === FileIcon);
  assert.equal(icons.length, 1, 'one icon per delivered row');
  assert.equal(icons[0].props.path, delivered.path);
  const row = descendants(root).find((node) => node.props.children?.includes(icons[0]));
  assert.equal(row.props.children[0], icons[0], 'delivered icon precedes its filename');
  const preview = descendants(row).find((node) => node.type === 'button');
  assert.ok(preview, 'delivered preview remains available');
  preview.props.onClick();
  assert.deepEqual(opened, [delivered.path]);
});
