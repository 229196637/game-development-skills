const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { patch, MARKER } = require('./patch.cjs');
const source = 'const CSS_GLASS = `body { color: red; }`;\nconst sentinel = 42;';
test('injects only into the glass template and preserves surrounding code', () => {
  const result = patch(source);
  assert.ok(result.endsWith('`;\nconst sentinel = 42;'));
  assert.ok(result.startsWith('const CSS_GLASS = `body { color: red; }'));
  assert.equal(result.split(MARKER).length, 2);
  new vm.Script(result);
});
test('refuses repeated or incompatible bundles', () => {
  assert.throws(() => patch(patch(source)), /already present/);
  assert.throws(() => patch('no CSS'), /one CSS_GLASS/);
  assert.throws(() => patch(source + source), /one CSS_GLASS/);
  assert.throws(() => patch('const CSS_GLASS = `unterminated'), /template end/);
});
test('every new rule is gated, without global color or status overrides', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, 'popovers.css'), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').filter(s => s.trim());
  assert.equal(rules.length, 4);
  for (const rule of rules) assert.match(rule, /^\s*body(?:\[data-ds-dark-theme\])?\[data-we-glass-page\]\[data-we-floater-solid\]/);
  assert.doesNotMatch(css, /--dsw-alias-state-|font-family\s*:|opacity\s*:|position\s*:|z-index\s*:/);
});
