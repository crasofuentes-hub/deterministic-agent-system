# Examples

These examples are intentionally small and copyable.

They are designed to help a new user understand the current v0.5.0 local enterprise operations workflow without reading the full codebase.

## Available examples

### Local CLI

Path:

    examples/local-cli/

Shows how to use the local CLI wrapper:

- npm run cli -- help
- npm run cli -- backup -KeepLast 20
- npm run cli -- check-handoffs
- npm run cli -- snapshot -SkipBackup

### Live Pilot Operations

Path:

    examples/live-pilot-ops/

Shows the supervised WhatsApp live pilot operations flow:

- start local pilot
- run smoke
- inspect readiness
- inspect metrics
- check pending handoffs
- create snapshot
- create SQLite backup

### Payment Audit

Path:

    examples/payment-audit/

Shows the deterministic insurance payment-audit vertical:

- payment status lookup
- payment history
- policy servicing
- discrepancy review
- customer payment history

## Recommended order

1. Start with examples/local-cli.
2. Then run examples/live-pilot-ops.
3. Then inspect examples/payment-audit.

## Validation

After trying examples, validate the current contractual baseline:

    Set-Location "C:\repos\deterministic-agent-system"

    npm run test:baseline:contractual

Expected v0.5.0 baseline:

    13 test files
    191 tests
