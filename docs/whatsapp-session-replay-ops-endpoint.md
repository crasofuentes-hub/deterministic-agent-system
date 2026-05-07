# WhatsApp Session Replay Ops Endpoint

The WhatsApp session replay ops endpoint exposes deterministic replay summaries through a protected operational API.

It allows operators to verify and replay a customer journal session without direct database access.

## Endpoint

    GET /whatsapp/conversations/:customerId/replay

Example:

    GET /whatsapp/conversations/5215512345678/replay

## Security

The endpoint uses the same operational controls as the WhatsApp journal, evidence, events, and handoff routes.

Required header:

    x-ops-token: <OPS_API_TOKEN>

Required environment variable:

    OPS_API_TOKEN

Rate limit scope:

    whatsapp-ops

If the ops token is missing, the endpoint returns:

    401

with:

    x-ops-token header is required

If the ops token is invalid, the endpoint returns:

    401

with:

    invalid x-ops-token header

## Runtime dependency

The endpoint requires:

    asyncWhatsAppRuntime.journal

If no journal is configured, the endpoint returns:

    500

with:

    whatsapp journal is not configured

## Session ID strategy

The endpoint maps the WhatsApp customer id to the journal session id:

    whatsapp:<customerId>

Example:

    customerId: 5215512345678
    sessionId: whatsapp:5215512345678

## Replay behavior

By default, the endpoint calls:

    replaySession(journal, sessionId)

The replay engine first checks journal integrity.

Replay only succeeds when:

    integrityOk === true

If journal integrity fails, the endpoint returns:

    409

with the deterministic replay error payload.

## Bounded replay with untilSequence

The endpoint supports bounded replay through:

    untilSequence

Example:

    GET /whatsapp/conversations/5215512345678/replay?untilSequence=2

When `untilSequence` is provided, the endpoint calls:

    replayUntilSequence(journal, sessionId, untilSequence)

This replays only journal events with:

    sequence <= untilSequence

Invalid values return:

    400

with contractual error shape:

    error:
      code: INVALID_REQUEST
      message: untilSequence must be a positive integer
      retryable: false

## Successful response shape

Successful response:

    ok
    customerId
    sessionId
    integrityOk
    replayedUntilSequence
    eventsReplayed
    finalState
    replayHash

Example:

    {
      "ok": true,
      "customerId": "5215512345678",
      "sessionId": "whatsapp:5215512345678",
      "integrityOk": true,
      "replayedUntilSequence": 2,
      "eventsReplayed": 2,
      "finalState": {
        "sessionId": "whatsapp:5215512345678",
        "eventCount": 2,
        "eventTypes": {
          "message_received": 1,
          "message_processed": 1
        },
        "lastEventId": "journal:5215512345678:wamid.example:processed",
        "lastEventType": "message_processed",
        "lastSequence": 2,
        "lastTimestamp": "2026-05-06T01:00:01.000Z",
        "appliedOverrides": []
      },
      "replayHash": "<sha256>"
    }

## Replay hash

The endpoint returns:

    replayHash

The replay hash is deterministic and derived from canonical replay content.

It changes when replay-relevant journal content changes.

## Current implementation files

    src/http/handlers/whatsapp-conversation-replay.ts
    src/http/routes.ts
    src/replay/journal-replay-engine.ts

## Current tests

    tests/http/whatsapp-conversation-replay-route.test.ts
    tests/replay/journal-replay-engine.test.ts

The test suite verifies:

- protected route success
- ops token rejection
- deterministic configuration error when journal is missing
- deterministic replay summary
- bounded replay with `untilSequence`
- contractual invalid `untilSequence` errors
- deterministic replay hash format

## Related docs

    docs/journal-replay-engine.md
    docs/whatsapp-session-journal-ops-endpoint.md
    docs/tamper-evident-execution-journal.md
    docs/async-whatsapp-journal-integration.md
    docs/postgres-execution-journal.md
    docs/postgres-journal-runtime-integration.md

## Investor-facing capability summary

This endpoint demonstrates:

- protected replay API access
- deterministic session replay
- integrity-gated replay
- deterministic replay hash
- customer-level audit replay
- compatibility with durable Postgres-backed journal sessions
- separation between runtime-specific API and generic replay engine

## Boundary rule

The endpoint is WhatsApp-specific.

The replay engine remains domain-agnostic.

The endpoint depends on the generic `ExecutionJournal` contract and the generic Journal Replay Engine.