# Postgres Journal Runtime Integration

The async WhatsApp runtime uses the durable Postgres Execution Journal when the runtime is configured with the Postgres store backend.

This connects the production-like WhatsApp persistence path, the tamper-evident execution journal, and the Journal Replay Engine.

## Current status

Implemented:

- Async WhatsApp runtime supports an `ExecutionJournal`.
- Memory and SQLite async runtime modes use the in-memory execution journal.
- Postgres async runtime mode uses the Postgres execution journal.
- Postgres journal migrations are applied during async runtime resolution.
- The Postgres store and Postgres execution journal share the same deterministic Postgres pool.
- Async WhatsApp webhook journal events are durable when Postgres store mode is enabled.
- Durable journal sessions are compatible with the Journal Replay Engine.

Current implementation files:

    src/channels/whatsapp/runtime-async.ts
    src/channels/whatsapp/store-factory.ts
    src/journal/postgres-execution-journal.ts
    src/replay/journal-replay-engine.ts

Current tests:

    tests/channels/whatsapp.runtime-async-postgres-journal.test.ts
    tests/journal/postgres-execution-journal.test.ts
    tests/replay/journal-replay-engine.test.ts
    tests/http/whatsapp-webhook-async-journal.test.ts

## Runtime behavior

When async WhatsApp runtime is enabled:

    WHATSAPP_RUNTIME_MODE=async

and the selected store backend is Postgres:

    WHATSAPP_STORE_MODE=postgres

or when store mode is omitted and async mode defaults to Postgres, the runtime uses:

    createPostgresExecutionJournal({ pool })

For memory or SQLite store modes, the runtime uses:

    createInMemoryExecutionJournal()

## Postgres migration behavior

The runtime applies the Postgres execution journal migration before exposing the runtime journal.

Migration id:

    0002_execution_journal_events

Migration table:

    det_agent_schema_migrations

Journal table:

    execution_journal_events

This preserves the tamper-evident hash chain in durable storage.

## Shared pool behavior

The async WhatsApp store factory exposes the Postgres pool used by the Postgres WhatsApp store.

The runtime uses that same pool for the Postgres execution journal.

This avoids creating a second independent Postgres connection path for the journal and keeps runtime lifecycle management centralized.

## Replay compatibility

Because the Postgres execution journal implements the generic `ExecutionJournal` contract, it can be replayed directly:

    const replay = await replaySession(runtime.journal, "whatsapp:5215512345678");

The replay engine verifies integrity before replay and returns a deterministic replay hash.

## Investor-facing capability summary

This runtime path supports:

- durable journal persistence
- tamper-evident hash-chain integrity
- per-session verification
- replay over durable journal sessions
- deterministic replay hash
- async WhatsApp runtime integration
- Postgres production-like operation

## Boundary rule

The runtime chooses the journal adapter.

The journal core remains domain-agnostic.

The Postgres journal adapter remains storage-specific but not WhatsApp-specific.

The replay engine depends only on the generic journal contract.