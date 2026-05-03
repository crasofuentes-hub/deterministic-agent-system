# NPM Readiness

This document records the current npm packaging readiness state for deterministic-agent-system.

## Current status

- Package version: 0.5.0
- Package name: deterministic-agent-system
- Package remains private: true
- npm publication has not been performed
- Local packaging preflight has been validated
- Installation from a generated .tgz has been validated
- det-agent help works from an installed package
- det-agent backup works from an installed package

## Validated package contents

The package includes:

- dist/
- LICENSE
- README.md
- package.json
- scripts/backup-live-pilot-sqlite.ps1
- scripts/check-whatsapp-handoffs.ps1
- scripts/live-pilot.env.ps1.example
- scripts/smoke-live-pilot.ps1
- scripts/snapshot-live-pilot-ops.ps1
- scripts/start-live-pilot.ps1

The package intentionally does not include local runtime data, local runtime backups, or local environment files.

## Last validated npm pack dry run

Latest observed npm pack --dry-run summary:

- package size: 112.7 kB
- unpacked size: 577.2 kB
- total files: 155
- package.json size: 10.3 kB

## Validated installed-package behavior

The package was installed into a temporary consumer directory from a generated .tgz.

Validated commands:

    npx det-agent help
    npx det-agent backup -KeepLast 1

The backup command successfully resolved packaged scripts from the installed package root, generated a backup, generated a manifest, and exited with code 0.

## Important packaging fix

The CLI originally resolved operational PowerShell scripts from process.cwd().

That failed in installed-package usage because the consumer directory did not contain the repository scripts folder.

The CLI now resolves packaged scripts from the package root.

The backup script also supports both relative and absolute paths for SQLite database and backup directories.

## Commands for future verification

From the repository root:

    Set-Location "C:\repos\deterministic-agent-system"

    npm run build
    npm run test:baseline:contractual
    npm pack --dry-run

Optional installed-package test:

    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $packDir = Join-Path $env:TEMP "das-pack-$stamp"
    $consumerDir = Join-Path $env:TEMP "das-consumer-$stamp"
    New-Item -ItemType Directory -Force $packDir | Out-Null
    New-Item -ItemType Directory -Force $consumerDir | Out-Null

    $packOutput = npm pack --pack-destination $packDir
    $tgzName = ($packOutput | Select-Object -Last 1).Trim()
    $tgzPath = Join-Path $packDir $tgzName

    Set-Location $consumerDir
    npm init -y | Out-Null
    npm install $tgzPath

    npx det-agent help

    $env:WHATSAPP_SQLITE_PATH = Join-Path $consumerDir ".runtime-data\whatsapp-live-pilot.sqlite"
    New-Item -ItemType Directory -Force (Split-Path $env:WHATSAPP_SQLITE_PATH -Parent) | Out-Null
    [System.IO.File]::WriteAllBytes($env:WHATSAPP_SQLITE_PATH, [byte[]]@(1,2,3,4))

    npx det-agent backup -KeepLast 1

## Before actual npm publication

Do not publish until these items are explicitly reviewed:

- Package name decision
- private changed from true to false
- npm account and access confirmed
- npm publish --dry-run passes
- README install instructions updated
- release notes mention npm publication
- installed-package smoke is repeated from a clean temporary directory

## Current recommendation

The package is ready for a publication decision, but npm publication should remain a separate explicit release step.
