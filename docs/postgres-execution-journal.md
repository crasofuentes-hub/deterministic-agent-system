# Postgres Execution Journal

The Postgres Execution Journal adapter provides durable persistence for tamper-evident journal events.

It implements the same generic `ExecutionJournal` contract as the in-memory journal adapter, while storing events in Postgres.

## Current status

Implemented:

- Postgres-backed `ExecutionJournal` adapter.
- Execution journal schema migration.
- Durable event append.
- Per-session monotonic sequence assignment.
- Durable `hashPrev` and `hashSelf` persistence.
- Chain verification through `verifyChain(sessionId)`.
- Session retrieval through `getSessionJournal(sessionId, options)`.
- Integration compatibility with the Journal Replay Engine.
- Contractual tests using a deterministic fake Postgres pool.

Current implementation files:

    src/journal/postgres-execution-journal.ts
    src/journal/index.ts

Current tests:

    tests/journal/postgres-execution-journal.test.ts

Related replay support:

    src/replay/journal-replay-engine.ts
    tests/replay/journal-replay-engine.test.ts

## Public API

Apply migrations:

    applyPostgresExecutionJournalMigrations(pool, appliedAtIso)

Create adapter:

    createPostgresExecutionJournal({ pool })

The returned object implements:

    ExecutionJournal

with:

    appendEvent(event)
    verifyChain(sessionId)
    getSessionJournal(sessionId, options)

## Schema migration

The adapter owns this migration id:

    0002_execution_journal_events

The migration creates:

    execution_journal_events

with durable fields:

    session_id
    sequence
    event_id
    timestamp_iso
    event_type
    payload_json
    metadata_json
    hash_prev
    hash_self

Primary key:

    (session_id, sequence)

Uniqueness rule:

    (session_id, event_id)

Indexes:

    execution_journal_events_session_id_idx
    execution_journal_events_event_id_idx

## Hash-chain persistence

Each stored event persists:

    hash_prev
    hash_self

`hash_prev` points to the previous event hash in the same session.

`hash_self` is calculated from canonical event content:

    eventId
    sessionId
    sequence
    timestamp
    type
    payload
    hashPrev
    metadata

This allows the adapter to detect tampering after data has been stored.

## Append behavior

When appending a new event:

1. The adapter loads the latest event for the session.
2. It assigns the next monotonic sequence.
3. It sets `hashPrev` from the latest event's `hashSelf`.
4. It computes `hashSelf`.
5. It inserts the event into Postgres.

This preserves deterministic journal ordering per session.

## Integrity verification

The adapter verifies chain integrity by loading all events for a session in sequence order and recomputing the hash chain.

API:

    verifyChain(sessionId)

Expected result:

    true

when the chain is intact.

Expected result:

    false

when the stored rows have been tampered with.

## Replay compatibility

The Postgres adapter is compatible with the Journal Replay Engine because it implements the generic `ExecutionJournal` contract.

Example:

    const journal = createPostgresExecutionJournal({ pool });
    const replay = await replaySession(journal, "whatsapp:5215512345678");

This means durable journal sessions can be replayed without changing the replay layer.

## Empty sessions

A session with no events is treated as an intact empty journal.

Expected result:

    verifyChain("missing-session") === true

Expected session journal:

    events: []
    integrityOk: true

## Boundary rule

The Postgres adapter must remain storage-specific but domain-agnostic.

It may depend on:

    DeterministicPostgresPool
    ExecutionJournal
    journal hashing utilities

It must not depend on:

- WhatsApp-specific runtime types
- insurance-specific types
- queue adapters
- LLM provider implementations
- replay-specific storage assumptions

Runtime integrations may choose this adapter, but the adapter itself remains generic.