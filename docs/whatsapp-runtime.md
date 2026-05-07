# WhatsApp Runtime

This document describes the current WhatsApp runtime persistence and delivery modes.

## Current status

The WhatsApp runtime supports:

- WhatsApp webhook verification.
- WhatsApp webhook POST handling.
- Inbound message normalization into the customer-message contract.
- Bridge execution through the customer-service agent.
- Canonical outbound response generation.
- Configurable delivery mode: `skipped`, `mock`, or `http`.
- Configurable store mode: `memory`, `sqlite`, or `postgres`.
- Session persistence.
- Idempotency by `channelMessageId`.
- Conversation evidence persistence.
- Conversation event persistence.
- Handoff persistence.
- Tamper-evident journal events for async WhatsApp message processing.
- Async Postgres-backed runtime for production-like operation.

## Journal integration

The async WhatsApp runtime records tamper-evident journal events for inbound and processed messages.

See:

    docs/async-whatsapp-journal-integration.md

When async WhatsApp uses the Postgres store backend, those journal events are stored through the durable Postgres Execution Journal.

See:

    docs/postgres-journal-runtime-integration.md

## Runtime modes

The server can run the WhatsApp path in two runtime modes:

- Synchronous runtime: default local path.
- Async runtime: required for Postgres-backed persistence.

The synchronous runtime keeps the local zero-config default and uses the in-memory store unless `WHATSAPP_STORE_MODE` is set explicitly.

The async runtime is the recommended production-like path. When `WHATSAPP_RUNTIME_MODE=async` is enabled and `WHATSAPP_STORE_MODE` is omitted, the async runtime prefers the Postgres-backed store.

## Environment variables

Required for all WhatsApp runtime modes:

    WHATSAPP_VERIFY_TOKEN

Runtime selection:

    WHATSAPP_RUNTIME_MODE=async

Delivery mode:

    WHATSAPP_DELIVERY_MODE=skipped | mock | http

Store mode:

    WHATSAPP_STORE_MODE=memory | sqlite | postgres

For async Postgres-backed persistence:

    DATABASE_URL=postgres://user:password@localhost:5432/deterministic_agent_system

Optional Postgres pool tuning:

    POSTGRES_POOL_MAX=10
    POSTGRES_IDLE_TIMEOUT_MS=30000
    POSTGRES_CONNECTION_TIMEOUT_MS=5000
    POSTGRES_STATEMENT_TIMEOUT_MS=15000

Optional deterministic timestamp overrides:

    POSTGRES_MIGRATION_APPLIED_AT_ISO=2026-03-24T00:00:00.000Z
    WHATSAPP_PROCESSED_AT_ISO=2026-03-24T00:00:00.000Z

For SQLite local or legacy operation:

    WHATSAPP_SQLITE_PATH=C:\repos\deterministic-agent-system\.runtime-data\whatsapp-runtime.sqlite

For HTTP delivery mode:

    WHATSAPP_API_VERSION=v23.0
    WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
    WHATSAPP_ACCESS_TOKEN=your-access-token

## Recommended async Postgres configuration

PowerShell:

    $env:WHATSAPP_VERIFY_TOKEN = "verify-token-001"
    $env:WHATSAPP_RUNTIME_MODE = "async"
    $env:DATABASE_URL = "postgres://user:password@localhost:5432/deterministic_agent_system"
    $env:WHATSAPP_DELIVERY_MODE = "skipped"
    $env:WHATSAPP_BUSINESS_CONTEXT_ID = "customer-service-core-v2"
    $env:WHATSAPP_SESSION_ID_PREFIX = "whatsapp-session"

    node .\dist\src\index.js serve

In this mode:

- The async runtime selects the Postgres store by default.
- `DATABASE_URL` is required.
- Postgres migrations are applied automatically by the async store factory.
- Delivery mode `skipped` processes the webhook without sending an external WhatsApp message.

## Explicit local memory override

For local async development without Postgres:

    $env:WHATSAPP_VERIFY_TOKEN = "verify-token-001"
    $env:WHATSAPP_RUNTIME_MODE = "async"
    $env:WHATSAPP_STORE_MODE = "memory"
    $env:WHATSAPP_DELIVERY_MODE = "skipped"

    node .\dist\src\index.js serve

This keeps local development lightweight while preserving Postgres as the recommended async runtime persistence path.

## Legacy local SQLite configuration

SQLite remains available for local or legacy workflows that need file-backed persistence without Postgres.

PowerShell:

    $env:WHATSAPP_VERIFY_TOKEN = "verify-token-001"
    $env:WHATSAPP_DELIVERY_MODE = "skipped"
    $env:WHATSAPP_STORE_MODE = "sqlite"
    $env:WHATSAPP_SQLITE_PATH = "C:\repos\deterministic-agent-system\.runtime-data\whatsapp-runtime.sqlite"
    $env:WHATSAPP_BUSINESS_CONTEXT_ID = "customer-service-core-v2"
    $env:WHATSAPP_SESSION_ID_PREFIX = "whatsapp-session"

    node .\dist\src\index.js serve

## Webhook verification

GET:

    /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token-001&hub.challenge=abc123

Expected result:

- Status 200.
- Body `abc123`.

## Recommended operational check

Validated flow:

1. Start the server with async Postgres persistence.
2. Send a first message that leaves the conversation waiting for a missing entity.
3. Restart the server.
4. Send a second message that completes the missing entity.
5. Re-send the same second message.

Expected result:

- The session survives restart.
- The second message resolves correctly.
- The replay of the same `channelMessageId` is marked as duplicate.
- Conversation evidence remains persisted in Postgres.

## Operational recommendation

- For production-like or live-pilot operation: use `WHATSAPP_RUNTIME_MODE=async` with Postgres.
- For async local development without Postgres: explicitly set `WHATSAPP_STORE_MODE=memory`.
- For legacy local file-backed operation: explicitly set `WHATSAPP_STORE_MODE=sqlite`.
- For tests without external delivery: use `WHATSAPP_DELIVERY_MODE=skipped` or `mock`.
- For real integration: use `WHATSAPP_DELIVERY_MODE=http` with configured WhatsApp credentials.