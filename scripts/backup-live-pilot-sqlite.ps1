param(
  [string]$DbPath = $env:WHATSAPP_SQLITE_PATH,
  [string]$BackupDir = ".\.runtime-backups",
  [int]$KeepLast = 20
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbPath)) {
  throw "WHATSAPP_SQLITE_PATH must be set in the current session or passed as -DbPath."
}

if ($KeepLast -lt 1) {
  throw "KeepLast must be greater than or equal to 1."
}

function Resolve-OperationalPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue
  )

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

$resolvedDbPath = Resolve-OperationalPath -PathValue $DbPath

if (!(Test-Path $resolvedDbPath)) {
  throw "SQLite database not found: $resolvedDbPath"
}

$resolvedBackupDir = Resolve-OperationalPath -PathValue $BackupDir

if (!(Test-Path $resolvedBackupDir)) {
  New-Item -ItemType Directory -Path $resolvedBackupDir -Force | Out-Null
}

$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$dbFileName = [System.IO.Path]::GetFileName($resolvedDbPath)
$backupFileName = "$timestamp-$dbFileName"
$backupPath = Join-Path $resolvedBackupDir $backupFileName
$manifestPath = "$backupPath.manifest.json"

Copy-Item -Path $resolvedDbPath -Destination $backupPath -Force

$hash = Get-FileHash -Path $backupPath -Algorithm SHA256

$manifest = [ordered]@{
  ok = $true
  sourcePath = $resolvedDbPath
  backupPath = $backupPath
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  sha256 = $hash.Hash.ToLowerInvariant()
  bytes = (Get-Item $backupPath).Length
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5

[System.IO.File]::WriteAllText(
  $manifestPath,
  $manifestJson + [Environment]::NewLine,
  (New-Object System.Text.UTF8Encoding($false))
)

$existingBackups = Get-ChildItem -Path $resolvedBackupDir -File -Filter "*-$dbFileName" |
  Sort-Object LastWriteTimeUtc -Descending

$oldBackups = @($existingBackups | Select-Object -Skip $KeepLast)

foreach ($oldBackup in $oldBackups) {
  $oldManifest = $oldBackup.FullName + ".manifest.json"

  Remove-Item -Path $oldBackup.FullName -Force

  if (Test-Path $oldManifest) {
    Remove-Item -Path $oldManifest -Force
  }
}

$result = [ordered]@{
  ok = $true
  backupPath = $backupPath
  manifestPath = $manifestPath
  sha256 = $hash.Hash.ToLowerInvariant()
  bytes = (Get-Item $backupPath).Length
  retainedBackups = [Math]::Min($existingBackups.Count, $KeepLast)
}

$result | ConvertTo-Json -Depth 5 | Out-Host