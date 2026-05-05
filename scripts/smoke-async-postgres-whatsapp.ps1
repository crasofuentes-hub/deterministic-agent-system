Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  throw "DATABASE_URL is required. Example: postgres://det_agent:det_agent@localhost:5432/deterministic_agent_system"
}

$previousEnv = @{}
$envKeys = @(
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_RUNTIME_MODE",
  "WHATSAPP_STORE_MODE",
  "WHATSAPP_DELIVERY_MODE",
  "POSTGRES_MIGRATION_APPLIED_AT_ISO",
  "WHATSAPP_PROCESSED_AT_ISO"
)

foreach ($key in $envKeys) {
  $previousEnv[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
}

try {
  $env:WHATSAPP_VERIFY_TOKEN = "local-smoke-token"
  $env:WHATSAPP_RUNTIME_MODE = "async"
  $env:WHATSAPP_STORE_MODE = "postgres"
  $env:WHATSAPP_DELIVERY_MODE = "skipped"
  $env:POSTGRES_MIGRATION_APPLIED_AT_ISO = "2026-03-24T00:00:00.000Z"
  $env:WHATSAPP_PROCESSED_AT_ISO = "2026-03-24T00:00:00.000Z"

  Write-Host "`n== BUILD ==" -ForegroundColor Cyan
  npm run build

  Write-Host "`n== ASYNC POSTGRES WHATSAPP SMOKE ==" -ForegroundColor Cyan
  node ".\scripts\smoke-async-postgres-whatsapp.cjs"
} finally {
  foreach ($key in $envKeys) {
    $value = $previousEnv[$key]
    if ($null -eq $value) {
      [System.Environment]::SetEnvironmentVariable($key, $null, "Process")
    } else {
      [System.Environment]::SetEnvironmentVariable($key, [string]$value, "Process")
    }
  }
}