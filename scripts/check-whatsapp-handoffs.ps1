param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$OpsToken = $env:OPS_API_TOKEN,
  [switch]$AllowOpen
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OpsToken)) {
  throw "OPS_API_TOKEN must be set in the current session or passed as -OpsToken."
}

$response = Invoke-WebRequest -Uri ($BaseUrl + "/whatsapp/handoffs") -Method Get -Headers @{ "x-ops-token" = $OpsToken } -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
$count = [int]$json.count

$result = [ordered]@{
  ok = ($count -eq 0 -or $AllowOpen.IsPresent)
  openHandoffCount = $count
  allowOpen = $AllowOpen.IsPresent
  items = $json.items
}

$result | ConvertTo-Json -Depth 10 | Out-Host

if ($count -gt 0 -and -not $AllowOpen.IsPresent) {
  exit 2
}

exit 0
