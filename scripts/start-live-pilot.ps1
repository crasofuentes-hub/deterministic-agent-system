param(
  [string]$EnvFile = ".\scripts\live-pilot.env.ps1",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (Test-Path $EnvFile) {
  . $EnvFile
} else {
  Write-Host "Env file not found: $EnvFile" -ForegroundColor Yellow
  Write-Host "Create it from .\scripts\live-pilot.env.ps1.example before starting the live pilot." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force ".\.runtime-data" | Out-Null

if (-not $SkipBuild) {
  Write-Host "`n== BUILD ==" -ForegroundColor Cyan
  npm run build
}

Write-Host "`n== START LIVE PILOT ==" -ForegroundColor Cyan
node .\dist\src\scripts\run-live-pilot.js