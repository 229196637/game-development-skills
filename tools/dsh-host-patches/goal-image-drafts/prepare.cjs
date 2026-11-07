// Read an exact supported archive and prepare isolated artifacts. Never installs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { patchConversation } = require('./conversation.cjs');
const { patchGoal } = require('./goal.cjs');
const provenance = require('./provenance.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function archiveEntry(archive, name) {
  if (archive.length < 16 || archive.readUInt32LE(0) !== 4) throw new Error('Invalid ASAR header');
  const jsonSize = archive.readUInt32LE(12);
  const dataStart = 8 + archive.readUInt32LE(4);
  if (16 + jsonSize > dataStart || dataStart > archive.length) throw new Error('Invalid ASAR header bounds');
  let entry = JSON.parse(archive.subarray(16, 16 + jsonSize).toString('utf8'));
  for (const part of name.split('/')) entry = entry?.files?.[part];
  if (!entry || entry.unpacked || entry.link || entry.files) throw new Error('Missing packed file: ' + name);
  const offset = Number(entry.offset), size = entry.size;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(size) || size < 0 || dataStart + offset + size > archive.length) throw new Error('Invalid ASAR entry bounds: ' + name);
  return archive.subarray(dataStart + offset, dataStart + offset + size);
}

function prepare(archivePath, outputDirectory, buildArchive = false) {
  const archive = path.resolve(archivePath);
  const output = path.resolve(outputDirectory);
  if (fs.existsSync(output)) throw new Error('Refusing existing output directory: ' + output);
  const bytes = fs.readFileSync(archive);
  if (hash(bytes) !== provenance.archiveSha256) throw new Error('Unsupported archive version/hash; input and output left unchanged');
  // Validate all source and transformed fingerprints before creating output.
  const transforms = { conversation: patchConversation, goal: patchGoal };
  const sources = provenance.entries.map(record => {
    const original = archiveEntry(bytes, record.entry);
    if (hash(original) !== record.originalSha256) throw new Error('Original hash mismatch: ' + record.entry);
    const patched = record.transform ? Buffer.from(transforms[record.transform](original.toString('utf8'))) : undefined;
    if (patched && hash(patched) !== record.patchedSha256) throw new Error('Patched hash mismatch: ' + record.entry);
    return { ...record, original, patched };
  });
  fs.mkdirSync(output, { recursive: true });
  // Custom output paths may be inside a checkout too. Never offer generated
  // upstream files, local absolute paths or backups to Git's default add.
  fs.writeFileSync(path.join(output, '.gitignore'), '*\n', { flag: 'wx' });
  const patches = [];
  for (const record of sources) {
    const originalFile = path.join(output, 'original', record.entry);
    fs.mkdirSync(path.dirname(originalFile), { recursive: true });
    fs.writeFileSync(originalFile, record.original, { flag: 'wx' });
    if (!record.patched) continue;
    const file = path.join(output, 'patched', record.entry);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, record.patched, { flag: 'wx' });
    patches.push({ entry: record.entry, file, originalSha256: record.originalSha256 });
  }
  fs.writeFileSync(path.join(output, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  if (buildArchive) {
    const manifestPath = path.join(output, 'manifest.json');
    const resultPath = path.join(output, 'app.patched.asar');
    fs.writeFileSync(manifestPath, JSON.stringify({ archive, output: resultPath, patches }, null, 2));
    const child = spawnSync(process.execPath, [path.join(__dirname, 'prepare-archive.cjs'), manifestPath], { stdio: 'inherit' });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error('Archive builder failed: ' + child.status);
    if (hash(fs.readFileSync(resultPath)) !== provenance.patchedArchiveSha256) throw new Error('Patched archive fingerprint mismatch; do not install');
    fs.writeFileSync(path.join(output, 'deployment-hashes.json'), JSON.stringify({ original: provenance.archiveSha256, patched: provenance.patchedArchiveSha256 }, null, 2));
  }
  return output;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    let archive, output = path.join(__dirname, '.artifacts'), buildArchive = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--archive' && args[i + 1]) archive = args[++i];
      else if (args[i] === '--output-dir' && args[i + 1]) output = args[++i];
      else if (args[i] === '--build-archive') buildArchive = true;
      else throw new Error('Unknown or incomplete option: ' + args[i]);
    }
    if (!archive) throw new Error('Usage: node prepare.cjs --archive <original-app.asar> [--output-dir <new-directory>] [--build-archive]');
    console.log('Prepared verified artifacts: ' + prepare(archive, output, buildArchive));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { archiveEntry, prepare };
