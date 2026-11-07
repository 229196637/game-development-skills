const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prepare, sha } = require('./patch.cjs');
test('installer dry-run, safe install, repeat install, guarded rollback and settings preservation', () => {
  assert.equal(process.platform, 'win32', 'Installer validation requires Windows');
  assert.ok(process.env.DSH_PATCH_TEST_DIR && process.env.DSH_PATCH_PROFILE, 'Set explicit test and read-only fixture directories');
  const root = fs.mkdtempSync(path.join(process.env.DSH_PATCH_TEST_DIR, 'installer-'));
  const profile = path.join(root, 'profile'), target = path.join(profile, 'node_modules/dsh-plugin-wallpaper-engine-glass/lib/client.glass.js');
  const backup = path.join(root, 'backup'), output = path.join(root, 'built'), user = path.join(root, 'user');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.mkdirSync(user);
  const original = fs.readFileSync(process.env.DSH_PATCH_GLASS_CLIENT || path.join(process.env.DSH_PATCH_PROFILE, 'node_modules/dsh-plugin-wallpaper-engine-glass/lib/client.glass.js'));
  fs.writeFileSync(target, original);
  const settings = path.join(profile, 'cordis.patch.yml'); fs.writeFileSync(settings, 'enabled: true\nuntouched: yes\n');
  const manifest = prepare(target, output);
  const run = (flags = [], quiet = false) => spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'install.ps1'),'-ProfileDirectory',profile,'-ArtifactsDirectory',output,'-BackupDirectory',backup,...flags], { stdio: quiet ? 'ignore' : 'inherit', env: { ...process.env, USERPROFILE: user } }).status;
  assert.equal(run(['-CheckOnly']),0); assert.equal(fs.existsSync(backup),false); assert.ok(fs.readFileSync(target).equals(original));
  assert.equal(run(),0); assert.equal(sha(fs.readFileSync(target)),manifest.patchedSha256);
  assert.equal(run(),0); assert.ok(fs.readFileSync(path.join(backup,'client.glass.original.js')).equals(original));
  assert.equal(fs.readFileSync(settings,'utf8'),'enabled: true\nuntouched: yes\n');
  // Simulate transaction A holding the per-target lock before either contender starts.
  const lockPath = target + '.popover-fix.lock', lock = fs.openSync(lockPath,'wx');
  try {
    assert.notEqual(run([],true),0, 'second install cannot enter transaction');
    assert.notEqual(run(['-Rollback'],true),0, 'rollback cannot enter during install');
    assert.equal(sha(fs.readFileSync(target)),manifest.patchedSha256);
  } finally {
    fs.closeSync(lock);
    assert.equal(path.resolve(lockPath),path.resolve(target + '.popover-fix.lock'));
    fs.unlinkSync(lockPath);
  }
  fs.appendFileSync(target,'\n// concurrent edit'); const concurrent = fs.readFileSync(target);
  assert.notEqual(run(['-Rollback'],true),0); assert.ok(fs.readFileSync(target).equals(concurrent));
  fs.copyFileSync(path.join(output,'client.glass.js'),target);
  assert.equal(run(['-Rollback']),0); assert.ok(fs.readFileSync(target).equals(original));
  assert.equal(fs.readFileSync(settings,'utf8'),'enabled: true\nuntouched: yes\n');
});
