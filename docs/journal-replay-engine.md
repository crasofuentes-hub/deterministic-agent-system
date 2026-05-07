# Journal Replay Engine

The Journal Replay Engine replays tamper-evident execution journal sessions into deterministic replay summaries.

It turns the execution journal from an audit log into a verifiable replay surface.

## Current status

Implemented:

- Full session replay.
- Replay until a specific sequence.
- Replay with controlled overrides.
- Deterministic replay hash.
- Deterministic replay state reduction.
- Integrity check before replay.
- Deterministic failure when integrity fails.
- Deterministic failure when a sequence is missing.
- Deterministic failure for invalid overrides.

Current implementation files:

    src/replay/journal-replay-engine.ts
    src/replay/index.ts

Current tests:

    tests/replay/journal-replay-engine.test.ts
    tests/journal/postgres-execution-journal.test.ts

Durable journal adapter:

    docs/postgres-execution-journal.md

Operational replay endpoint:

    docs/whatsapp-session-replay-ops-endpoint.md
    tests/http/whatsapp-conversation-replay-route.test.ts

The WhatsApp replay ops endpoint supports bounded replay through:

    untilSequence

## Public API

Replay full session:

    replaySession(journal, sessionId)

Replay until a sequence:

    replayUntilSequence(journal, sessionId, sequence)

Replay with override:

    replayWithOverride(journal, sessionId, overrides)

## Replay result

Successful replay result:

    ok: true
    sessionId
    integrityOk: true
    replayedUntilSequence
    eventsReplayed
    events
    finalState
    replayHash

Failure replay result:

    ok: false
    sessionId
    integrityOk: false
    error:
      code
      message

## Replay integrity behavior

Before replay, the engine calls:

    getSessionJournal(sessionId, { integrityCheck: true })

Replay only proceeds when:

    integrityOk === true

If the journal chain is broken, replay fails with:

    JOURNAL_INTEGRITY_CHECK_FAILED

This prevents replay from producing trusted results from tampered journal data.

## Replay state

The replay engine reduces journal events into a deterministic final state:

    sessionId
    eventCount
    eventTypes
    lastEventId
    lastEventType
    lastSequence
    lastTimestamp
    appliedOverrides

This state is intentionally generic. Runtime-specific interpretation should live outside the core replay engine.

## Replay hash

Each successful replay produces:

    replayHash

The replay hash is derived from canonical JSON over:

    sessionId
    replayedUntilSequence
    event hashes
    replayed event content
    finalState

The hash changes when replay-relevant content changes.

## Replay until sequence

`replayUntilSequence` allows bounded replay.

Example:

    replayUntilSequence(journal, "whatsapp:5215512345678", 2)

Expected behavior:

- Replays only events with sequence <= 2.
- Fails if sequence 2 does not exist.
- Produces a deterministic replay hash for the partial replay.

## Replay with override

`replayWithOverride` simulates controlled changes without mutating the original journal.

Overrides can target:

    sequence

or:

    eventId

An override may replace:

    payload
    metadata

The original journal remains unchanged.

This is useful for deterministic what-if analysis while preserving the original audit chain.

## Failure codes

Current deterministic failure codes:

    JOURNAL_INTEGRITY_CHECK_FAILED
    REPLAY_SEQUENCE_NOT_FOUND
    INVALID_REPLAY_OVERRIDE

## Boundary rule

The replay engine depends on the generic Journal contract.

It must not depend on:

- WhatsApp-specific types
- insurance-specific types
- queue infrastructure
- database adapters
- LLM provider implementations

Runtime-specific replay reports may be built above this layer, but the core replay engine must remain domain-agnostic.