# Example: Live Pilot Operations

This example shows the local supervised WhatsApp live pilot operations flow introduced in v0.5.0.

It focuses on operator-visible checks rather than new framework internals.

## Prerequisites

- Windows PowerShell
- Node.js and npm
- repository cloned locally
- scripts/live-pilot.env.ps1 configured locally

## Prepare local environment

    Set-Location "C:\repos\deterministic-agent-system"

    if (!(Test-Path ".\scripts\live-pilot.env.ps1")) {
      Copy-Item ".\scripts\live-pilot.env.ps1.example" ".\scripts\live-pilot.env.ps1" -Force
    }

Edit scripts/live-pilot.env.ps1 with local values. Do not commit it.

## Start the live pilot

Terminal 1:

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    powershell -ExecutionPolicy Bypass -File .\scripts\start-live-pilot.ps1

Expected server output:

    Live pilot server listening on http://127.0.0.1:3000

## Run the smoke test

Terminal 2:

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    npm run cli -- smoke

The smoke validates:

- health
- readiness
- webhook verification
- quote message handling
- handoff message handling
- conversation evidence
- conversation events
- handoff list
- handoff close
- final empty handoff queue
- metrics

## Inspect readiness

    Invoke-WebRequest -Uri "http://127.0.0.1:3000/ready" -Method Get -UseBasicParsing

Expected result:

    "ok": true
    "status": "ready"

## Inspect metrics

    . .\scripts\live-pilot.env.ps1

    Invoke-WebRequest -Uri "http://127.0.0.1:3000/metrics" -Method Get -Headers @{ "x-ops-token" = $env:OPS_API_TOKEN } -UseBasicParsing

Metrics include total requests, total errors, total rate-limited requests, and per-route counters.

## Create a daily snapshot

    . .\scripts\live-pilot.env.ps1

    npm run cli -- snapshot -SkipBackup

Use the snapshot as a daily operational evidence artifact.

## Check pending handoffs

    . .\scripts\live-pilot.env.ps1

    npm run cli -- check-handoffs

Exit code 0 means the handoff queue is empty. Exit code 2 means open handoffs exist.

## Backup SQLite

    . .\scripts\live-pilot.env.ps1

    npm run cli -- backup -KeepLast 20

The backup creates a timestamped SQLite copy and SHA-256 manifest under .runtime-backups/.
