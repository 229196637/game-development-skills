import assert from 'node:assert/strict';
import test from 'node:test';

import { groupFiles, isExternal, isHidden, normalizeRules, relPath } from '../lib/rules.js';

test('normalizeRules cleans folder prefixes', () => {
  const rules = normalizeRules({
    dirs: ['./Docs/', 'docs', 'RES\\Atlas', '/res/atlas/', '', '.'],
    exts: ['.META', 'meta', 'png', '.'],
  });
  assert.deepEqual(rules.dirs, ['docs', 'res/atlas']);
  assert.deepEqual(rules.exts, ['.meta', '.png']);
});

test('normalizeRules tolerates junk input', () => {
  assert.deepEqual(normalizeRules(null), { dirs: [], exts: [] });
  assert.deepEqual(normalizeRules('nope'), { dirs: [], exts: [] });
  assert.deepEqual(normalizeRules({ dirs: [1, null, 'ok'], exts: {} }), { dirs: ['ok'], exts: [] });
});

test('normalizeRules caps the rule count', () => {
  const dirs = Array.from({ length: 260 }, (_, index) => `d${index}`);
  assert.equal(normalizeRules({ dirs }).dirs.length, 200);
});

test('relPath strips the workspace prefix and normalizes separators', () => {
  const cwd = 'D:\\Project\\GameProject\\dahuaxiyou';
  assert.equal(relPath('D:\\Project\\GameProject\\dahuaxiyou\\docs\\a.md', cwd), 'docs/a.md');
  assert.equal(relPath('D:/Project/GameProject/dahuaxiyou/src/b.lua', cwd), 'src/b.lua');
  assert.equal(relPath('./docs/c.md', cwd), 'docs/c.md');
  assert.equal(relPath('D:\\Other\\d.md', cwd), 'D:/Other/d.md');
});

test('isExternal distinguishes absolute and drive paths', () => {
  assert.equal(isExternal('/tmp/x.lua'), true);
  assert.equal(isExternal('C:/temp/x.lua'), true);
  assert.equal(isExternal('docs/x.lua'), false);
});

test('isHidden matches folders by segment, not by string prefix', () => {
  const rules = { dirs: ['docs', 'res/atlas'], exts: ['.meta'] };
  assert.equal(isHidden('docs/a.md', rules), true);
  assert.equal(isHidden('docs', rules), true);
  assert.equal(isHidden('docs2/a.md', rules), false);
  assert.equal(isHidden('res/atlas/ui.png', rules), true);
  assert.equal(isHidden('res/atlas2/ui.png', rules), false);
  assert.equal(isHidden('src/thing.meta', rules), true);
  assert.equal(isHidden('src/thing.meta.bak', rules), false);
  assert.equal(isHidden('src/thing.lua', rules), false);
  assert.equal(isHidden('docs/a.md', { dirs: [], exts: [] }), false);
});

test('isHidden is case insensitive, matching the normalized rules', () => {
  const rules = normalizeRules({ dirs: ['Docs'], exts: ['.PNG'] });
  assert.equal(isHidden('docs/a.md', rules), true);
  assert.equal(isHidden('res/ui.Png', rules), true);
});

test('groupFiles buckets by first segment, root, and external paths', () => {
  const items = [
    { relative: 'docs/a.md', added: 1, deleted: 0 },
    { relative: 'docs/b.md', added: 2, deleted: 1 },
    { relative: 'src/c.lua', added: 3, deleted: 0 },
    { relative: 'README.md', added: 1, deleted: 1 },
    { relative: 'C:/elsewhere/d.lua', added: 1, deleted: 0 },
  ];
  const groups = groupFiles(items);
  const byId = new Map(groups.map((group) => [group.id, group]));
  assert.deepEqual([...byId.keys()].sort(), ['__external__', '__root__', 'docs', 'src']);
  // The largest bucket leads; the rest are ordered by display label.
  assert.equal(groups[0].id, 'docs');
  assert.deepEqual(byId.get('docs').files.map((item) => item.relative), ['docs/a.md', 'docs/b.md']);
  assert.equal(byId.get('docs').added, 3);
  assert.equal(byId.get('docs').deleted, 1);
  assert.equal(byId.get('__root__').files.length, 1);
  assert.equal(byId.get('__external__').files.length, 1);
});

test('groupFiles returns nothing for an empty list', () => {
  assert.deepEqual(groupFiles([]), []);
});
