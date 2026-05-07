# WhatsApp Session Journal Ops Endpoint

The WhatsApp session journal ops endpoint exposes tamper-evident journal sessions through a protected operational API.

It makes the durable/runtime journal auditable from HTTP instead of only through tests or internal code.

## Endpoint

    GET /whatsapp/conversations/:customerId/journal

Example:

    GET /whatsapp/conversations/5215512345678/journal

## Security

The endpoint is protected by the same ops controls used by the existing WhatsApp operational routes.

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

## Response shape

Successful response:

    ok
    customerId
    sessionId
    integrityOk
    count
    events

Example:

    {
      "ok": true,
      "customerId": "5215512345678",
      "sessionId": "whatsapp:5215512345678",
      "integrityOk": true,
      "count": 2,
      "events": []
    }

## Integrity behavior

The endpoint calls:

    getSessionJournal(sessionId, { integrityCheck: true })

This means every response includes:

    integrityOk

A true value means the journal chain passed verification.

The chain verification validates:

- monotonic sequence
- `hashPrev` linkage
- `hashSelf` recomputation
- payload integrity
- metadata integrity

## Current implementation files

    src/http/handlers/whatsapp-conversation-journal.ts
    src/http/routes.ts

## Current tests

    tests/http/whatsapp-conversation-journal-route.test.ts

The test suite verifies:

- protected route success
- ops token rejection
- deterministic configuration error when journal is missing
- hash-chain linkage in the returned events

## Related docs

    docs/tamper-evident-execution-journal.md
    docs/async-whatsapp-journal-integration.md
    docs/postgres-execution-journal.md
    docs/postgres-journal-runtime-integration.md
    docs/journal-replay-engine.md

Related replay endpoint:

    docs/whatsapp-session-replay-ops-endpoint.md

## Investor-facing capability summary

This endpoint demonstrates:

- live operational audit access
- per-customer journal retrieval
- tamper-evident chain visibility
- integrity verification at read time
- protected ops API access
- compatibility with Postgres-backed durable journal sessions

## Boundary rule

The endpoint is WhatsApp-specific.

The journal core remains domain-agnostic.

The endpoint depends on the generic `ExecutionJournal` contract and does not depend on a concrete journal adapter.