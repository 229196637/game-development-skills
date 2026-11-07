'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MARKER = '/* dsh-local:wallpaper-popovers-v1 */';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function patch(source) {
  if (source.includes(MARKER)) throw new Error('Popover patch already present');
  const anchor = 'const CSS_GLASS = `';
  const start = source.indexOf(anchor);
  if (start < 0 || source.indexOf(anchor, start + 1) >= 0) throw new Error('Expected one CSS_GLASS anchor');
  const end = source.indexOf('`;', start + anchor.length);
  if (end < 0) throw new Error('Missing CSS_GLASS template end');
  const css = fs.readFileSync(path.join(__dirname, 'popovers.css'), 'utf8');
  if (css.includes('`') || css.includes('${')) throw new Error('CSS must not alter JavaScript template syntax');
  return source.slice(0, end) + '\n' + MARKER + '\n' + css + source.slice(end);
}
function prepare(input, output) {
  const provenance = require('./provenance.json');
  const original = fs.readFileSync(input);
  if (sha(original) !== provenance.originalSha256) throw new Error('Unsupported glass bundle: SHA256 mismatch');
  const source = original.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(original)) throw new Error('Input is not round-trip UTF-8');
  const patched = Buffer.from(patch(source));
  fs.mkdirSync(output, { recursive: false });
  fs.writeFileSync(path.join(output, '.gitignore'), '*\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'client.glass.js'), patched, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ originalSha256: sha(original), patchedSha256: sha(patched) }, null, 2) + '\n', { flag: 'wx' });
  return { originalSha256: sha(original), patchedSha256: sha(patched) };
}
module.exports = { patch, prepare, sha, MARKER };
if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node patch.cjs <installed-client.glass.js> <new-output-directory>');
  console.log(JSON.stringify(prepare(path.resolve(input), path.resolve(output)), null, 2));
}
