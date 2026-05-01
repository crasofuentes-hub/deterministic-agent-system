param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$OpsToken = $env:OPS_API_TOKEN,
  [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OpsToken)) {
  throw "OPS_API_TOKEN must be set in the current session or passed as -OpsToken."
}

function Invoke-JsonGet {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [hashtable]$Headers = @{}
  )

  $response = Invoke-WebRequest -Uri $Uri -Method Get -Headers $Headers -UseBasicParsing
  return $response.Content | ConvertFrom-Json
}

$ready = Invoke-JsonGet -Uri ($BaseUrl + "/ready")
$metrics = Invoke-JsonGet -Uri ($BaseUrl + "/metrics") -Headers @{ "x-ops-token" = $OpsToken }
$handoffs = Invoke-JsonGet -Uri ($BaseUrl + "/whatsapp/handoffs") -Headers @{ "x-ops-token" = $OpsToken }

$backup = $null
if (-not $SkipBackup.IsPresent) {
  $backupOutput = powershell -ExecutionPolicy Bypass -File .\scripts\backup-live-pilot-sqlite.ps1 | Out-String
  $backup = $backupOutput | ConvertFrom-Json
}

$snapshot = [ordered]@{
  ok = ($ready.ok -eq $true -and $metrics.ok -eq $true -and [int]$handoffs.count -eq 0)
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  baseUrl = $BaseUrl
  ready = $ready
  metrics = $metrics.metrics
  openHandoffCount = [int]$handoffs.count
  openHandoffs = $handoffs.items
  backup = $backup
}

$snapshot | ConvertTo-Json -Depth 20 | Out-Host

if ($snapshot.ok -ne $true) {
  exit 2
}

exit 0
