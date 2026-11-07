'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const withFullscreen = require('./fullscreen.cjs');

const BASELINE = 'a95daf319acba1bda03cfc5a1740e0076004270b371783666fcc6ee482daa44e';
const MARKER = '/* dsh-genui-fullscreen:v1 */';
const END_MARKER = '/* /dsh-genui-fullscreen:v1 */';
// Exact shipped first revision; allow only this audited fullscreen → card upgrade.
const LEGACY_FULLSCREEN = '19bd8e0d47313fb4ea0b55cc9c3dea7b47d20e933db71da9cde738a1f4dc4d84';
// Audited 0.15.0 ExportableGenuiBlock: retain its state capture/export renderer.
const ANCHOR = 'function Sh(e){let t=(0,o.useRef)(void 0),n=(0,o.useCallback)(e=>{t.current=e},[]),r=(0,o.useCallback)(()=>$m(e.spec,t.current),[e.spec]),{exportEnabled:i=!0,...a}=e;return(0,l.jsxs)(`div`,{"data-genui-artifact":!0,children:[(0,l.jsx)(yp,{...a,onStateSnapshot:n}),i&&(0,l.jsx)(xh,{getArtifact:r})]})}';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readCss = () => fs.readFileSync(path.join(__dirname, 'fullscreen.css'), 'utf8');

function patchBytes(bytes) {
  const source = bytes.toString('utf8');
  // Reject corrupt/non-UTF8 bundles rather than silently normalizing bytes.
  if (!Buffer.from(source, 'utf8').equals(bytes)) throw new Error('Client bundle is not lossless UTF-8');
  if (source.includes(MARKER)) {
    const start = source.indexOf(MARKER), end = source.indexOf(END_MARKER, start);
    if (end < 0) throw new Error('Incomplete fullscreen patch');
    const original = Buffer.from(source.slice(0, start) + source.slice(end + END_MARKER.length));
    if (sha(original) !== BASELINE) throw new Error('Patched bundle has an unknown upstream baseline');
    const expected = patchBytes(original);
    if (sha(bytes) === LEGACY_FULLSCREEN) return expected;
    if (!expected.equals(bytes)) throw new Error('Installed fullscreen patch differs; review before updating');
    return bytes;
  }
  if (sha(bytes) !== BASELINE) throw new Error('Unsupported client SHA256; refusing to patch another build');
  if (source.split(ANCHOR).length !== 2) throw new Error('ExportableGenuiBlock anchor must occur exactly once');
  const addition = `${MARKER}\nSh=(${withFullscreen.toString()})(Sh,o,${JSON.stringify(readCss())});\n${END_MARKER}`;
  const result = Buffer.from(source.replace(ANCHOR, ANCHOR + addition));
  new vm.Script(result.toString('utf8'), { filename: 'genui-fullscreen-client.js' });
  return result;
}

const SETTINGS = ['cordis.yml', 'cordis.patch.yml', 'package.json', 'pnpm-lock.yaml', 'desktop-next.cordis.patch.json', 'desktop-next.runtime.patch.json'];
function snapshot(profile) {
  return Object.fromEntries(SETTINGS.filter(name => fs.existsSync(path.join(profile, name)))
    .map(name => [name, sha(fs.readFileSync(path.join(profile, name)))]));
}
function atomicWrite(target, bytes) {
  const temporary = target + `.fullscreen-${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); }
  catch (error) { fs.unlinkSync(temporary); throw error; }
}
function install(profile, backupRoot) {
  const target = path.join(profile, 'node_modules', '@changfenhuang', 'dsh-genui', 'lib', 'client.js');
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(target), '..', 'package.json'), 'utf8'));
  if (pkg.name !== '@changfenhuang/dsh-genui' || pkg.version !== '0.15.0') throw new Error('Unsupported GenUI package/version');
  const before = fs.readFileSync(target), after = patchBytes(before);
  if (before.equals(after)) return { status: 'already-installed', target, sha256: sha(after) };
  const configHashes = snapshot(profile);
  const backup = path.join(backupRoot, `genui-fullscreen-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(backup, 'client.js'), before, { flag: 'wx' });
  for (const name of Object.keys(configHashes)) fs.copyFileSync(path.join(profile, name), path.join(backup, name));
  const receipt = { target, profile, originalSha256: sha(before), patchedSha256: sha(after), configHashes };
  fs.writeFileSync(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2));
  // Only the client bundle changes. Settings and plugin switches are never written.
  atomicWrite(target, after);
  if (sha(fs.readFileSync(target)) !== receipt.patchedSha256) throw new Error('Installed bundle verification failed');
  if (JSON.stringify(snapshot(profile)) !== JSON.stringify(configHashes)) throw new Error('Profile settings changed concurrently; inspect backup, do not reset settings');
  return { status: 'installed', target, backup, sha256: receipt.patchedSha256, settingsUnchanged: true };
}
function restore(backup) {
  const receipt = JSON.parse(fs.readFileSync(path.join(backup, 'receipt.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(backup, 'client.js'));
  if (sha(bytes) !== receipt.originalSha256 || ![BASELINE, LEGACY_FULLSCREEN].includes(receipt.originalSha256)) throw new Error('Backup fingerprint mismatch');
  const currentSha = sha(fs.readFileSync(receipt.target));
  if (currentSha === receipt.originalSha256) return { status: 'already-restored' };
  if (currentSha !== receipt.patchedSha256) throw new Error('Current bundle changed after installation; refusing rollback');
  atomicWrite(receipt.target, bytes);
  if (sha(fs.readFileSync(receipt.target)) !== receipt.originalSha256) throw new Error('Rollback verification failed');
  return { status: 'restored', target: receipt.target, settingsRestored: false };
}
module.exports = { BASELINE, LEGACY_FULLSCREEN, MARKER, ANCHOR, sha, patchBytes, install, restore, snapshot };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
    const profile = value('--profile');
    let result;
    if (value('--restore')) result = restore(path.resolve(value('--restore')));
    else if (profile && value('--backup-root')) result = install(path.resolve(profile), path.resolve(value('--backup-root')));
    else throw new Error('Usage: node patch.cjs --profile PROFILE --backup-root BACKUPS | --restore BACKUP');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
