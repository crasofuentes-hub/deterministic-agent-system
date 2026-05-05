# Portable Ops Migration

This document defines the finite migration plan for operational scripts.

## Rule

```text
PowerShell is allowed as a Windows execution convenience for the maintainer.
Node.js / TypeScript must be the source of truth for product, operational, verification, smoke, and live-pilot logic.
PowerShell wrappers may remain only as thin wrappers around Node.js / TypeScript commands.
```

## Current PowerShell inventory

- backup-live-pilot-sqlite.ps1
- check-whatsapp-handoffs.ps1
- demo-determinism.ps1
- generate-status.ps1
- guardrail-staged.ps1
- live-pilot.env.ps1
- smoke-async-postgres-whatsapp.ps1
- smoke-live-pilot.ps1
- snapshot-live-pilot-ops.ps1
- start-live-pilot.ps1
- test-tap.ps1
- verify-bootstrap.ps1
- verify-contract.ps1
- verify-pack.ps1
## Migration classes

### A. Core verification

Scripts related to build, contracts, bootstrap verification, package verification, or CI checks.

Target:

```text
src/scripts/verify-*.ts
npm run verify:*
PowerShell wrappers optional only
```

### B. Smoke tests

Scripts that prove a local runtime path works end-to-end.

Target:

```text
src/scripts/smoke-*.ts
npm run smoke:*
PowerShell wrappers optional only
```

First target:

```text
scripts/smoke-async-postgres-whatsapp.ps1
scripts/smoke-async-postgres-whatsapp.cjs
-> src/scripts/smoke-async-postgres-whatsapp.ts
```

### C. Live pilot operations

Scripts that start, inspect, or manage a live pilot runtime.

Target:

```text
src/scripts/live-pilot-*.ts
npm run live-pilot:*
PowerShell wrappers optional only
```

### D. Backup, snapshot, and handoff utilities

Scripts that create backups, snapshots, or operational handoff reports.

Target:

```text
src/scripts/backup-*.ts
src/scripts/snapshot-*.ts
src/scripts/check-*.ts
npm run ops:*
PowerShell wrappers optional only
```

## Finite execution plan

1. Inventory PowerShell operational scripts and classify migration targets.
2. Move async Postgres WhatsApp smoke to TypeScript as the source of truth.
3. Move contract verification helpers to TypeScript.
4. Move WhatsApp handoff checks to TypeScript.
5. Move backup and snapshot utilities to TypeScript.
6. Update public documentation to show Node/npm commands first.
7. Add CI checks for portable Node/TypeScript ops scripts.

## Non-goals for this migration

- Do not remove PowerShell wrappers immediately.
- Do not change runtime behavior while migrating wrappers.
- Do not add new product features during this migration block.
- Do not make Postgres the default persistence path in this block.
- Do not introduce BullMQ, Temporal, or distributed orchestration in this block.

## Completion criteria

This migration block is complete when:

```text
Operational source of truth is Node.js / TypeScript.
PowerShell scripts are thin Windows wrappers only.
README and docs show npm/node commands first.
CI validates portable Node/TypeScript operational scripts.
Main contractual baseline remains green.
LLM/live contractual suite remains green.
```

## Validation commands

```powershell
npm run build
npm run test:baseline:contractual
npm run test:llm-live:contractual
git status --short
```
## Completed migrations

### Async Postgres WhatsApp smoke

```text
Source of truth: src/scripts/smoke-async-postgres-whatsapp.ts
NPM command: npm run smoke:whatsapp:postgres
Windows wrapper: scripts/smoke-async-postgres-whatsapp.ps1
Removed duplicate CJS source: scripts/smoke-async-postgres-whatsapp.cjs
```

### Verify pack

```text
Source of truth: src/scripts/verify-pack.ts
NPM command: npm run verify:pack
Windows wrapper: scripts/verify-pack.ps1
Package policy: published tarball must not include package/scripts/*
```
