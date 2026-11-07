const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepare, archiveEntry } = require('../prepare.cjs');
const { patchGoal } = require('../goal.cjs');
const { patchConversation } = require('../conversation.cjs');
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-patch-tooling-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  return directory;
}
test('maintainer cannot create artifacts from an unsupported archive', t => {
  const directory = temporary(t), input = path.join(directory, 'original.asar'), output = path.join(directory, 'out');
  fs.writeFileSync(input, 'unsupported release');
  assert.throws(() => prepare(input, output), /Unsupported archive version\/hash/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.readFileSync(input, 'utf8'), 'unsupported release');
});
test('maintainer cannot overwrite an existing artifact directory', t => {
  const directory = temporary(t), output = path.join(directory, 'out');
  fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'keep'), 'existing');
  assert.throws(() => prepare(path.join(directory, 'missing.asar'), output), /Refusing existing output directory/);
  assert.equal(fs.readFileSync(path.join(output, 'keep'), 'utf8'), 'existing');
});
test('maintainer gets a clear failure for malformed ASAR bounds', () => {
  assert.throws(() => archiveEntry(Buffer.alloc(0), 'file'), /Invalid ASAR header/);
  const prefix = Buffer.alloc(16); prefix.writeUInt32LE(4); prefix.writeUInt32LE(100, 4);
  assert.throws(() => archiveEntry(prefix, 'file'), /Invalid ASAR header bounds/);
});
test('maintainer cannot silently patch missing or changed upstream anchors', () => {
  assert.throws(() => patchGoal('upstream changed'), /Original-source mismatch/);
  assert.throws(() => patchConversation('upstream changed'), /non-unique patch anchor/);
});
test('maintainer gets portable sources without private machine paths', () => {
  for (const file of ['apply-fix.ps1', 'prepare.cjs', 'fixtures.cjs', 'tests/browser-idb.test.cjs']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /[A-Z]:[\\/](?:Users|Tools|Project)[\\/]/i);
  }
});
