const fs = require('node:fs');
const path = require('node:path');
const fixtureRoot = path.resolve(process.env.DSH_PATCH_FIXTURES || path.join(__dirname, '.artifacts'));
if (!fs.existsSync(path.join(fixtureRoot, 'provenance.json'))) {
  throw new Error('Missing verified fixtures. Run prepare.cjs --archive <original-app.asar> first, or set DSH_PATCH_FIXTURES to its output directory.');
}
const crypto = require('node:crypto');
const provenance = require('./provenance.json');
for (const record of provenance.entries) {
  for (const [kind, expected] of [['original', record.originalSha256], ['patched', record.patchedSha256]]) {
    if (!expected) continue;
    const file = path.join(fixtureRoot, kind, record.entry);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== expected) throw new Error('Fixture fingerprint mismatch: ' + file);
  }
}
module.exports = { fixtureRoot };
