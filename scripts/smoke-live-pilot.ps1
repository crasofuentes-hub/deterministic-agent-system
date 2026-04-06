param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$VerifyToken = $env:WHATSAPP_VERIFY_TOKEN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($VerifyToken)) {
  throw "WHATSAPP_VERIFY_TOKEN must be set in the current session or passed as -VerifyToken."
}

Write-Host "`n== HEALTH ==" -ForegroundColor Cyan
$health = Invoke-WebRequest -Uri ($BaseUrl + "/health") -UseBasicParsing
$health.Content | Out-Host

Write-Host "`n== VERIFY WEBHOOK ==" -ForegroundColor Cyan
$verifyUrl = $BaseUrl + "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=" + $VerifyToken + "&hub.challenge=challenge-001"
$verify = Invoke-WebRequest -Uri $verifyUrl -UseBasicParsing
$verify.Content | Out-Host

Write-Host "`n== POST SAMPLE MESSAGE ==" -ForegroundColor Cyan
$body = @{
  object = "whatsapp_business_account"
  entry = @(
    @{
      id = "entry-001"
      changes = @(
        @{
          field = "messages"
          value = @{
            metadata = @{
              display_phone_number = "15551234567"
              phone_number_id = "phone-number-id-001"
            }
            contacts = @(
              @{
                profile = @{
                  name = "Live Pilot Customer"
                }
                wa_id = "5215512345678"
              }
            )
            messages = @(
              @{
                from = "5215512345678"
                id = "wamid.livepilot.001"
                timestamp = "1774310400"
                type = "text"
                text = @{
                  body = "I need a quote for Personal Auto Standard"
                }
              }
            )
          }
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$response = Invoke-WebRequest `
  -Uri ($BaseUrl + "/webhooks/whatsapp") `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ "x-request-id" = "req-live-pilot-smoke-001" } `
  -Body $body `
  -UseBasicParsing

$response.Content | Out-Host