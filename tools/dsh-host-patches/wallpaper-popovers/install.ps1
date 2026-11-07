param(
  [Parameter(Mandatory=$true)][string]$ProfileDirectory,
  [Parameter(Mandatory=$true)][string]$ArtifactsDirectory,
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [switch]$Rollback,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$profileRoot = (Resolve-Path -LiteralPath $ProfileDirectory).Path
$target = Join-Path $profileRoot 'node_modules\dsh-plugin-wallpaper-engine-glass\lib\client.glass.js'
$target = (Resolve-Path -LiteralPath $target).Path
$lockPath = $target + '.popover-fix.lock'
$lock = $null
try {
if (-not $CheckOnly) {
  # Exclusive creation serializes all installers for this exact package entry.
  # A leftover lock after a hard crash must be inspected, never silently removed.
  $lock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
}
$artifacts = (Resolve-Path -LiteralPath $ArtifactsDirectory).Path
$manifest = Get-Content -LiteralPath (Join-Path $artifacts 'manifest.json') -Raw | ConvertFrom-Json
$provenance = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'provenance.json') -Raw | ConvertFrom-Json
if ($manifest.originalSha256 -ne $provenance.originalSha256) { throw 'Manifest is for an unsupported original bundle' }
$hash = { param($p) (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
$current = & $hash $target
$backupRoot = [System.IO.Path]::GetFullPath($BackupDirectory)
$backupFile = Join-Path $backupRoot 'client.glass.original.js'
if ($Rollback) {
  if (-not (Test-Path -LiteralPath $backupFile)) { throw 'Original backup is missing' }
  if ((& $hash $backupFile) -ne $manifest.originalSha256) { throw 'Original backup hash mismatch' }
  if ($current -eq $manifest.originalSha256) { Write-Output 'Original bundle already installed'; exit 0 }
  if ($current -ne $manifest.patchedSha256) { throw 'Installed bundle changed; refusing rollback' }
  $source = $backupFile; $expected = $manifest.originalSha256
} else {
  $source = Join-Path $artifacts 'client.glass.js'; $expected = $manifest.patchedSha256
  if ((& $hash $source) -ne $expected) { throw 'Staged patch hash mismatch' }
  if ($current -eq $expected) { Write-Output 'Popover patch already installed'; exit 0 }
  if ($current -ne $manifest.originalSha256) { throw 'Installed bundle changed; refusing install' }
  if (Test-Path -LiteralPath $backupRoot) { throw 'Use a new backup directory; no existing backups are overwritten' }
}
$transaction = [guid]::NewGuid().ToString('N')
$temp = $target + '.popover-fix.' + $transaction + '.new'
if (Test-Path -LiteralPath $temp) { throw 'Temporary target exists; inspect before retrying' }
if ($CheckOnly) { Write-Output 'Checks passed; no files changed'; exit 0 }
if (-not $Rollback) {
  New-Item -ItemType Directory -Path $backupRoot | Out-Null
  Copy-Item -LiteralPath $target -Destination $backupFile
  if ((& $hash $backupFile) -ne $manifest.originalSha256) { throw 'Backup verification failed' }
  # Preserve composition settings privately without ever rewriting them.
  foreach ($name in @('cordis.yml','cordis.patch.yml','desktop-next.cordis.patch.json','desktop-next.runtime.patch.json')) {
    $item = Join-Path $profileRoot $name
    if (Test-Path -LiteralPath $item) { Copy-Item -LiteralPath $item -Destination (Join-Path $backupRoot $name) }
  }
  $appearance = Join-Path $env:USERPROFILE '.dsh-wallpaper-engine'
  foreach ($relative in @('config.json','fontsets\preset-font.json')) {
    $item = Join-Path $appearance $relative
    if (Test-Path -LiteralPath $item) { Copy-Item -LiteralPath $item -Destination (Join-Path $backupRoot ($relative.Replace('\','-'))) }
  }
}
[System.IO.File]::Copy($source, $temp, $false)
if ((& $hash $temp) -ne $expected) { throw 'Temporary patch verification failed' }
if ((& $hash $target) -ne $current) { throw 'Installed bundle changed during preparation' }
if ((Resolve-Path -LiteralPath $target).Path -ne $target) { throw 'Target path changed' }
# Replacing the directory entry avoids modifying any shared package-cache hardlink.
$recovery = Join-Path $backupRoot ('replaced-' + $transaction + '.js')
[System.IO.File]::Replace($temp, $target, $recovery)
if ((& $hash $target) -ne $expected) { throw 'Installed bundle verification failed; retain backup for recovery' }
Write-Output 'Bundle updated. No settings changed, no plugin toggles changed, no application restarted.'
Write-Output 'Restart DSH at a convenient time to reload the host-cached client module.'
} finally {
  if ($null -ne $lock) {
    $lock.Dispose()
    # This exact lock was created by this transaction, beside the verified target.
    if ([System.IO.Path]::GetFullPath($lockPath) -ne ($target + '.popover-fix.lock')) { throw 'Unexpected lock path' }
    [System.IO.File]::Delete($lockPath)
  }
}
