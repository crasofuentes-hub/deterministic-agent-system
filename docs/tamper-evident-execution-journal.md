# Tamper-Evident Execution Journal

The execution journal records auditable session events with deterministic hash-chain integrity.

It is designed to support serious operational use cases where a session must be inspectable, replayable, and verifiable after execution.

## Current status

Implemented:

- Journal event contract.
- Stored journal event contract.
- Canonical JSON hashing.
- SHA-256 event content hashing.
- `hashPrev` chain links.
- `hashSelf` event hashes.
- Per-session monotonic sequence numbers.
- In-memory execution journal adapter.
- Chain verification through `verifyChain(sessionId)`.
- Optional integrity check through `getSessionJournal(sessionId, { integrityCheck: true })`.
- Contractual tests for:
  - deterministic append metadata
  - hash chain verification
  - tampered payload detection
  - broken `hashPrev` detection
  - broken sequence detection
  - canonical key-order stable hashing

Current implementation files:

    src/journal/types.ts
    src/journal/hash.ts
    src/journal/in-memory-execution-journal.ts
    src/journal/index.ts

Current tests:

    tests/journal/execution-journal.test.ts
    tests/http/whatsapp-webhook-async-journal.test.ts

Current runtime integrations:

    docs/async-whatsapp-journal-integration.md

Replay support:

    docs/journal-replay-engine.md

## Event model

Input event shape:

    AppendJournalEventInput

Fields:

    eventId
    sessionId
    timestamp
    type
    payload
    metadata

Supported event types:

    plan
    tool_call
    tool_result
    llm_response
    handoff
    error
    convergence

Stored event shape:

    StoredJournalEvent

Additional stored fields:

    sequence
    hashPrev
    hashSelf

## Hash-chain design

Each stored event includes:

    hashPrev
    hashSelf

`hashPrev` points to the previous event hash in the same session.

`hashSelf` is calculated from the event's canonical content:

    eventId
    sessionId
    sequence
    timestamp
    type
    payload
    hashPrev
    metadata

This means changing the payload, sequence, timestamp, metadata, or previous hash link invalidates the chain.

## Canonical hashing

The journal uses canonical JSON stringification before hashing.

Canonical hashing ensures that equivalent object key ordering produces the same hash.

Example:

    { "a": 1, "b": 2 }

and:

    { "b": 2, "a": 1 }

produce the same canonical hash when the semantic content is equivalent.

Unsupported JSON values are rejected:

- undefined
- functions
- symbols
- bigint
- non-finite numbers

## Chain verification

The journal verifies:

- sequence starts at 1
- sequence increments monotonically
- each event's `hashPrev` matches the previous event's `hashSelf`
- each event's `hashSelf` matches the recomputed hash for its canonical content

API:

    verifyChain(sessionId)

Expected result:

    true

when the chain is intact.

Expected result:

    false

when the event list has been tampered with.

## Session journal retrieval

API:

    getSessionJournal(sessionId, { integrityCheck: true })

Returns:

    sessionId
    events
    integrityOk

When `integrityCheck` is true, the journal verifies the chain before returning the session journal.

## Current adapter

The current adapter is:

    createInMemoryExecutionJournal()

It is intended for:

- deterministic tests
- local development
- runtime integration before durable storage
- validating journal semantics

It does not provide durable persistence by itself.

## Future durable adapters

The journal contract is designed so future durable adapters can be added without changing consumers.

Expected future adapters:

- Postgres-backed execution journal
- file-backed local audit journal
- append-only object-store journal

A durable adapter should preserve the same public contract:

    appendEvent(event)
    verifyChain(sessionId)
    getSessionJournal(sessionId, options)

## Boundary rule

The journal contract must remain domain-agnostic.

It should not depend on:

- WhatsApp
- insurance
- LLM provider implementations
- concrete queue backends
- specific storage adapters

Runtime integrations may record domain-specific payloads, but the journal core must remain generic.