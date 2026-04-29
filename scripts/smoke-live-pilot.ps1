param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$VerifyToken = $env:WHATSAPP_VERIFY_TOKEN,
  [string]$OpsToken = $env:OPS_API_TOKEN,
  [string]$AppSecret = $env:WHATSAPP_APP_SECRET
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($VerifyToken)) {
  throw "WHATSAPP_VERIFY_TOKEN must be set in the current session or passed as -VerifyToken."
}

if ([string]::IsNullOrWhiteSpace($OpsToken)) {
  throw "OPS_API_TOKEN must be set in the current session or passed as -OpsToken."
}

function New-HmacSha256Signature {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BodyText,

    [Parameter(Mandatory = $true)]
    [string]$Secret
  )

  $encoding = [System.Text.Encoding]::UTF8
  $keyBytes = $encoding.GetBytes($Secret)
  $bodyBytes = $encoding.GetBytes($BodyText)

  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = $keyBytes

  try {
    $hashBytes = $hmac.ComputeHash($bodyBytes)
    $hex = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
    return "sha256=$hex"
  } finally {
    $hmac.Dispose()
  }
}

Write-Host "`n== HEALTH ==" -ForegroundColor Cyan
$health = Invoke-WebRequest -Uri ($BaseUrl + "/health") -UseBasicParsing
$health.Content | Out-Host

Write-Host "`n== VERIFY WEBHOOK ==" -ForegroundColor Cyan
$verifyUrl = $BaseUrl + "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=" + $VerifyToken + "&hub.challenge=challenge-001"
$verify = Invoke-WebRequest -Uri $verifyUrl -UseBasicParsing
$verify.Content | Out-Host

Write-Host "`n== POST SAMPLE MESSAGE ==" -ForegroundColor Cyan
$quoteMessageId = "wamid.livepilot.quote." + [Guid]::NewGuid().ToString("N")
$quoteBody = @{
  object = "whatsapp_business_account"
  entry = @(
    @{
      id = "entry-quote-001"
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
                id = $quoteMessageId
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

$quoteHeaders = @{
  "x-request-id" = "req-live-pilot-smoke-quote"
}

if (-not [string]::IsNullOrWhiteSpace($AppSecret)) {
  $quoteHeaders["x-hub-signature-256"] = New-HmacSha256Signature -BodyText $quoteBody -Secret $AppSecret
}

$quoteResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/webhooks/whatsapp") `
  -Method Post `
  -ContentType "application/json" `
  -Headers $quoteHeaders `
  -Body $quoteBody `
  -UseBasicParsing

$quoteResponse.Content | Out-Host

Write-Host "`n== POST HANDOFF MESSAGE ==" -ForegroundColor Cyan
$handoffMessageId = "wamid.livepilot.handoff." + [Guid]::NewGuid().ToString("N")
$handoffBody = @{
  object = "whatsapp_business_account"
  entry = @(
    @{
      id = "entry-handoff-001"
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
                id = $handoffMessageId
                timestamp = "1774310400"
                type = "text"
                text = @{
                  body = "I need to speak with a human agent"
                }
              }
            )
          }
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

$handoffHeaders = @{
  "x-request-id" = "req-live-pilot-smoke-handoff"
}

if (-not [string]::IsNullOrWhiteSpace($AppSecret)) {
  $handoffHeaders["x-hub-signature-256"] = New-HmacSha256Signature -BodyText $handoffBody -Secret $AppSecret
}

$handoffResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/webhooks/whatsapp") `
  -Method Post `
  -ContentType "application/json" `
  -Headers $handoffHeaders `
  -Body $handoffBody `
  -UseBasicParsing

$handoffResponse.Content | Out-Host

$handoffJson = $handoffResponse.Content | ConvertFrom-Json
$expectedHandoffId = "handoff:5215512345678:$handoffMessageId"

Write-Host "`n== GET CONVERSATION EVIDENCE ==" -ForegroundColor Cyan
$evidenceResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/whatsapp/conversations/5215512345678/evidence") `
  -Method Get `
  -Headers @{
    "x-ops-token" = $OpsToken
  } `
  -UseBasicParsing

$evidenceResponse.Content | Out-Host

$evidenceJson = $evidenceResponse.Content | ConvertFrom-Json
if ($evidenceJson.evidence.lastInboundMessageId -ne $handoffMessageId) {
  throw "Expected evidence lastInboundMessageId to be $handoffMessageId but got $($evidenceJson.evidence.lastInboundMessageId)"
}

if ($evidenceJson.evidence.lastResolvedIntentId -ne "request-human-handoff") {
  throw "Expected evidence lastResolvedIntentId to be request-human-handoff but got $($evidenceJson.evidence.lastResolvedIntentId)"
}

Write-Host "`n== GET CONVERSATION EVENTS ==" -ForegroundColor Cyan
$eventsResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/whatsapp/conversations/5215512345678/events") `
  -Method Get `
  -Headers @{
    "x-ops-token" = $OpsToken
  } `
  -UseBasicParsing

$eventsResponse.Content | Out-Host

$eventsJson = $eventsResponse.Content | ConvertFrom-Json
$expectedEventIds = @(
  "event:5215512345678:${quoteMessageId}:inbound",
  "event:5215512345678:${quoteMessageId}:outbound",
  "event:5215512345678:${handoffMessageId}:inbound",
  "event:5215512345678:${handoffMessageId}:outbound",
  "event:5215512345678:${handoffMessageId}:handoff"
)

$actualEventIds = @($eventsJson.items | ForEach-Object { $_.eventId })

foreach ($expectedEventId in $expectedEventIds) {
  if ($actualEventIds -notcontains $expectedEventId) {
    throw "Expected conversation events to include $expectedEventId"
  }
}

Write-Host "`n== LIST OPEN HANDOFFS ==" -ForegroundColor Cyan
$listResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/whatsapp/handoffs") `
  -Method Get `
  -Headers @{
    "x-ops-token" = $OpsToken
  } `
  -UseBasicParsing

$listResponse.Content | Out-Host

Write-Host "`n== CLOSE HANDOFF ==" -ForegroundColor Cyan
$closeResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/whatsapp/handoffs/" + [uri]::EscapeDataString($expectedHandoffId) + "/close") `
  -Method Post `
  -Headers @{
    "x-ops-token" = $OpsToken
  } `
  -UseBasicParsing

$closeResponse.Content | Out-Host

Write-Host "`n== LIST OPEN HANDOFFS AFTER CLOSE ==" -ForegroundColor Cyan
$listAfterCloseResponse = Invoke-WebRequest `
  -Uri ($BaseUrl + "/whatsapp/handoffs") `
  -Method Get `
  -Headers @{
    "x-ops-token" = $OpsToken
  } `
  -UseBasicParsing

$listAfterCloseResponse.Content | Out-Host