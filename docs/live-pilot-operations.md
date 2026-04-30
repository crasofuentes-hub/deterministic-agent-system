# Live Pilot Operations Runbook

This runbook documents how to operate the supervised WhatsApp live pilot for deterministic-agent-system.

## Current operational scope

The live pilot supports:

- WhatsApp webhook verification.
- Signed WhatsApp webhook POST validation when WHATSAPP_APP_SECRET is configured.
- Mock, skipped, or HTTP WhatsApp delivery modes.
- SQLite-backed session persistence.
- Conversation evidence persistence.
- Conversation event log persistence.
- Handoff queue persistence.
- HTTP handoff listing.
- HTTP handoff closure.
- Operational endpoint protection with x-ops-token.
- Configurable HTTP rate limiting.
- Operational readiness checks.
- SQLite backup with checksum manifest.

## Local files that must not be committed

These files and folders are local runtime artifacts:

- scripts/live-pilot.env.ps1
- .runtime-data/
- .runtime-backups/

They are intentionally ignored by Git.

## Required local environment

Create the local environment file from the example if it does not exist:

    Set-Location "C:\repos\deterministic-agent-system"

    if (!(Test-Path ".\scripts\live-pilot.env.ps1")) {
      Copy-Item ".\scripts\live-pilot.env.ps1.example" ".\scripts\live-pilot.env.ps1" -Force
    }

For a local mock pilot, scripts/live-pilot.env.ps1 should define:

    $env:HOST = "127.0.0.1"
    $env:PORT = "3000"

    $env:WHATSAPP_VERIFY_TOKEN = "test-token-2024"

    $env:WHATSAPP_DELIVERY_MODE = "mock"
    $env:WHATSAPP_STORE_MODE = "sqlite"
    $env:WHATSAPP_SQLITE_PATH = ".\.runtime-data\whatsapp-live-pilot.sqlite"

    $env:WHATSAPP_BUSINESS_CONTEXT_ID = "customer-service-core-v2"
    $env:WHATSAPP_SESSION_ID_PREFIX = "whatsapp-session"

    $env:OPS_API_TOKEN = "ops-token-123"
    $env:WHATSAPP_APP_SECRET = "app-secret-123"

    $env:HTTP_RATE_LIMIT_WINDOW_MS = "60000"
    $env:HTTP_RATE_LIMIT_MAX = "120"

## Start the live pilot

Terminal 1:

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    powershell -ExecutionPolicy Bypass -File .\scripts\start-live-pilot.ps1

The server should print:

    Live pilot server listening on http://127.0.0.1:3000
    Health endpoint: http://127.0.0.1:3000/health
    WhatsApp webhook: http://127.0.0.1:3000/webhooks/whatsapp

## Check health

    Set-Location "C:\repos\deterministic-agent-system"

    Invoke-WebRequest -Uri "http://127.0.0.1:3000/health" -Method Get -UseBasicParsing

## Check readiness

    Set-Location "C:\repos\deterministic-agent-system"

    Invoke-WebRequest -Uri "http://127.0.0.1:3000/ready" -Method Get -UseBasicParsing

If readiness returns 503, inspect the checks array and fix the failing configuration item.

## Run the operational smoke test

Terminal 2:

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    powershell -ExecutionPolicy Bypass -File .\scripts\smoke-live-pilot.ps1

The smoke validates health, readiness-sensitive configuration, webhook verification, quote handling, handoff handling, conversation evidence, conversation events, handoff listing, handoff closure, and final empty handoff queue.

Expected final state:

    {"ok":true,"count":0,"items":[]}

## List open handoffs

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    Invoke-WebRequest -Uri "http://127.0.0.1:3000/whatsapp/handoffs" -Method Get -Headers @{ "x-ops-token" = $env:OPS_API_TOKEN } -UseBasicParsing

## Close a handoff

Replace the handoff id with the value returned by the list endpoint.

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    $handoffId = "handoff:5215512345678:wamid.example"

    Invoke-WebRequest -Uri ("http://127.0.0.1:3000/whatsapp/handoffs/" + [uri]::EscapeDataString($handoffId) + "/close") -Method Post -Headers @{ "x-ops-token" = $env:OPS_API_TOKEN } -UseBasicParsing

## Inspect conversation evidence

This returns the latest persisted operational state for the customer.

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    $customerId = "5215512345678"

    Invoke-WebRequest -Uri ("http://127.0.0.1:3000/whatsapp/conversations/" + [uri]::EscapeDataString($customerId) + "/evidence") -Method Get -Headers @{ "x-ops-token" = $env:OPS_API_TOKEN } -UseBasicParsing

## Inspect conversation events

This returns the append-only operational event log for the customer, including inbound messages, outbound agent responses, and handoff events.

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    $customerId = "5215512345678"

    Invoke-WebRequest -Uri ("http://127.0.0.1:3000/whatsapp/conversations/" + [uri]::EscapeDataString($customerId) + "/events") -Method Get -Headers @{ "x-ops-token" = $env:OPS_API_TOKEN } -UseBasicParsing

## Backup SQLite

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    powershell -ExecutionPolicy Bypass -File .\scripts\backup-live-pilot-sqlite.ps1

The backup script creates a timestamped SQLite copy, a manifest JSON file, a SHA-256 checksum, byte size, and retention cleanup based on KeepLast.

## Recommended daily pilot sequence

1. Pull latest code.
2. Confirm scripts/live-pilot.env.ps1 exists and contains local runtime values.
3. Start the live pilot.
4. Check /ready.
5. Run the operational smoke test.
6. Operate handoffs through HTTP endpoints.
7. Inspect evidence and events when investigating a customer.
8. Run SQLite backup before shutdown or after meaningful pilot activity.

## Baseline verification

Before committing operational changes:

    Set-Location "C:\repos\deterministic-agent-system"

    npm run test:baseline:contractual

The contractual baseline must stay green before pushing to GitHub.

## Production notes

Before exposing beyond local development:

- Replace local test tokens.
- Use a real WHATSAPP_VERIFY_TOKEN.
- Use a real OPS_API_TOKEN.
- Use a real WHATSAPP_APP_SECRET.
- Enable rate limiting with production values.
- Use WHATSAPP_DELIVERY_MODE=http only after configuring WHATSAPP_API_VERSION, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_ACCESS_TOKEN.
- Store secrets in the deployment secret manager, not in Git.
- Keep SQLite backups outside the repository.
- Keep scripts/live-pilot.env.ps1 local and uncommitted.

## GitHub repository

Public repository:

    https://github.com/crasofuentes-hub/deterministic-agent-system
