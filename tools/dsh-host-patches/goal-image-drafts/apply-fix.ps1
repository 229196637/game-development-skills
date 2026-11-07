param(
    [Parameter(Mandatory=$true)][string]$InstallDirectory,
    [string]$WorkDirectory = (Join-Path $PSScriptRoot ".artifacts"),
    [switch]$Rollback, [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$base = (Get-Item -LiteralPath $WorkDirectory).FullName
$installation = (Get-Item -LiteralPath $InstallDirectory).FullName
$target = Join-Path $installation 'resources\app.asar'
$exe = Join-Path $installation 'DSH NEXT.exe'
$staged = Join-Path $base 'app.patched.asar'
$backup = Join-Path $base 'backup\app.original.asar'
$hashes = Get-Content -LiteralPath (Join-Path $base 'deployment-hashes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function AssertHash([string]$Path, [string]$Expected) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing file: $Path" }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected) { throw "Version/hash mismatch; no replacement performed: $Path" }
}
try {
    # These are exact, version-bound targets. Never infer installation from cwd.
    $resolved = (Get-Item -LiteralPath $target).FullName
    if ($resolved -ne $target) { throw 'Unexpected installation target.' }
    AssertHash $staged $hashes.patched
    if ($CheckOnly) {
        $current = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($current -ne $hashes.original -and $current -ne $hashes.patched) { throw 'Installed application version changed; rebuild this patch first.' }
        Write-Host 'CHECK OK: staged archive verified; installation target verified. No files changed.'
        exit 0
    }
    $running = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe })
    if ($running.Count -gt 0) {
        Write-Host 'Please fully exit DSH NEXT first (including its tray icon), then run this installer again.'
        Write-Host 'No process was stopped and no application file was changed.'
        exit 2
    }
    $current = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Rollback) {
        AssertHash $backup $hashes.original
        if ($current -eq $hashes.original) { Write-Host 'Original version already installed.'; exit 0 }
        AssertHash $target $hashes.patched
        $source = $backup
        $expected = $hashes.original
    } else {
        if ($current -eq $hashes.patched) { Write-Host 'Fix already installed.'; Start-Process -FilePath $exe; exit 0 }
        AssertHash $target $hashes.original
        New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
        if (Test-Path -LiteralPath $backup) { AssertHash $backup $hashes.original }
        else { Copy-Item -LiteralPath $target -Destination $backup; AssertHash $backup $hashes.original }
        $source = $staged
        $expected = $hashes.patched
    }
    $temp = $target + '.dsh-goal-image-fix.new'
    if (Test-Path -LiteralPath $temp) { throw "Temporary destination already exists; inspect before retrying: $temp" }
    Copy-Item -LiteralPath $source -Destination $temp
    AssertHash $temp $expected
    # Recheck after copy; refuse races with another running application or update.
    if (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe }).Count -gt 0) { throw 'DSH restarted while preparing replacement; installation stopped.' }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $current) { throw 'Installed archive changed while preparing replacement.' }
    if ((Get-Item -LiteralPath $temp).FullName -ne $temp -or (Get-Item -LiteralPath $target).FullName -ne $target) { throw 'Unexpected replacement paths.' }
    [System.IO.File]::Replace($temp, $target, $null)
    AssertHash $target $expected
    Write-Host 'SUCCESS: archive verified after replacement. Settings, plugins, sessions and credentials were not changed.'
    Start-Process -FilePath $exe
    exit 0
} catch {
    Write-Host ('FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No processes were forcibly stopped. Existing settings were not reset.'
    exit 1
}
