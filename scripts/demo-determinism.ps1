Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [int]$Runs = 5
)

function Get-Sha256Hex([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hash = $sha.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha.Dispose()
  }
}

function Normalize-Output([string]$s) {
  if ($null -eq $s) { return "" }
  # Normaliza newlines
  $t = $s -replace "`r`n", "`n"
  $t = $t -replace "`r", "`n"

  # Quita ruido tipico (timestamps, duraciones, etc.) si aparecen
  # (Conservador: no borra contenido funcional)
  $t = $t -replace "\b\d+ms\b", "<ms>"
  $t = $t -replace "\b\d+(\.\d+)?s\b", "<sec>"

  # Trim final
  return $t.Trim()
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

Write-Host "== demo:determinism ==" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host "Runs: $Runs"
Write-Host ""

$results = @()
for ($i = 1; $i -le $Runs; $i++) {
  Write-Host ("-- Run {0}/{1} --" -f $i, $Runs) -ForegroundColor Cyan

  # Ejecuta y captura stdout+stderr
  $out = & npm run -s test:determinism 2>&1 | Out-String
  $norm = Normalize-Output $out
  $hash = Get-Sha256Hex $norm

  $results += [PSCustomObject]@{
    Run = $i
    Hash = $hash
    Length = $norm.Length
  }

  Write-Host ("hash={0} len={1}" -f $hash, $norm.Length)

  # Guarda logs por run
  $dir = Join-Path $repoRoot "artifacts\demo-determinism"
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $logPath = Join-Path $dir ("run-{0:00}.log.txt" -f $i)
  [System.IO.File]::WriteAllText($logPath, $norm, (New-Object System.Text.UTF8Encoding($false)))
}

$baseline = $results[0].Hash
$bad = $results | Where-Object { $_.Hash -ne $baseline }

Write-Host "`n== Summary ==" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host

if ($bad.Count -gt 0) {
  Write-Host "`nFAIL: determinism mismatch detected." -ForegroundColor Red
  Write-Host ("Baseline: {0}" -f $baseline) -ForegroundColor Red
  $bad | ForEach-Object { Write-Host ("Run {0} hash {1}" -f $_.Run, $_.Hash) -ForegroundColor Red }
  exit 2
}

Write-Host "`nPASS: all runs matched." -ForegroundColor Green
exit 0