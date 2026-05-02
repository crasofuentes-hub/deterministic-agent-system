# Example: Local CLI

This example shows how to use the local deterministic-agent-system CLI without publishing the package to npm.

The CLI is a thin wrapper around already-tested PowerShell operational scripts.

## Prerequisites

- Windows PowerShell
- Node.js
- npm
- repository cloned locally

## Build

    Set-Location "C:\repos\deterministic-agent-system"

    npm install
    npm run build

## Show CLI help

    npm run cli -- help

Expected commands:

- snapshot
- check-handoffs
- backup
- smoke
- help

## Run a backup through the CLI

The backup command requires WHATSAPP_SQLITE_PATH to be configured.

    Set-Location "C:\repos\deterministic-agent-system"

    . .\scripts\live-pilot.env.ps1

    npm run cli -- backup -KeepLast 20

Expected result:

    "ok": true
    "backupPath": "..."
    "manifestPath": "..."
    "sha256": "..."

## Check pending handoffs

This command requires the live pilot HTTP server to be running.

    . .\scripts\live-pilot.env.ps1

    npm run cli -- check-handoffs

Expected result when the queue is empty:

    "ok": true
    "openHandoffCount": 0

## Create an operational snapshot

This command checks readiness, metrics, and open handoffs.

    . .\scripts\live-pilot.env.ps1

    npm run cli -- snapshot -SkipBackup

Expected result:

    "ok": true
    "openHandoffCount": 0

## Notes

- The package remains private in v0.5.0.
- The bin entry det-agent is prepared for future packaging.
- This example intentionally uses npm run cli to avoid global installation.
