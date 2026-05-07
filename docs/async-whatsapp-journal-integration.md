# Async WhatsApp Journal Integration

The async WhatsApp webhook runtime records tamper-evident journal events for processed WhatsApp messages.

This connects the generic execution journal to a real runtime path.

## Current status

Implemented:

- Async WhatsApp runtime creates an `ExecutionJournal`.
- HTTP routing passes the journal to the async WhatsApp webhook handler.
- The async webhook handler records received and processed message events.
- Duplicate message processing is recorded in the same journal chain.
- Handoff events are recorded when a human handoff is created.
- Journal chains are keyed by WhatsApp customer session.

Current implementation files:

    src/channels/whatsapp/runtime-async.ts
    src/http/routes.ts
    src/http/handlers/whatsapp-webhook-async.ts
    src/journal/types.ts

Current tests:

    tests/http/whatsapp-webhook-async-journal.test.ts

Durable Postgres runtime integration:

    docs/postgres-journal-runtime-integration.md
    tests/channels/whatsapp.runtime-async-postgres-journal.test.ts

## Session ID strategy

Journal events for WhatsApp are stored under this session id format:

    whatsapp:<customerId>

Example:

    whatsapp:5215512345678

This keeps the journal session stable across multiple inbound WhatsApp messages from the same customer.

## Recorded event types

The async WhatsApp runtime currently records:

    message_received
    message_processed
    handoff

### message_received

Recorded once for every normalized inbound WhatsApp message.

Payload includes:

    channel
    customerId
    channelMessageId
    text

Metadata includes:

    requestId

### message_processed

Recorded after the message has been processed.

For normal messages, payload includes:

    channel
    customerId
    channelMessageId
    duplicate
    deliveryStatus
    responseId
    resolvedIntentId
    stage
    status
    humanInterventionRequired

For duplicate messages, payload keeps deterministic null values for fields that are not reprocessed:

    responseId: null
    resolvedIntentId: null
    stage: null
    status: null
    humanInterventionRequired: null

### handoff

Recorded when the async WhatsApp flow creates a human handoff.

Payload includes:

    channel
    customerId
    channelMessageId
    handoffId
    responseId
    resolvedIntentId
    stage
    status
    handoffReasonCode
    handoffQueue

## Duplicate handling

When a duplicate `channelMessageId` is detected:

1. The inbound message is still journaled as `message_received`.
2. The duplicate result is journaled as `message_processed`.
3. The `message_processed` payload sets:

       duplicate: true
       deliveryStatus: "skipped"

4. Agent-specific fields that were not reprocessed are set to `null`.

This preserves an auditable trace of duplicate delivery attempts without pretending the agent ran again.

## Integrity behavior

The journal chain for a WhatsApp customer can be verified with:

    verifyChain("whatsapp:<customerId>")

A valid chain verifies:

- sequence order
- `hashPrev` linkage
- `hashSelf` recomputation
- payload integrity
- metadata integrity

## Boundary rule

The WhatsApp integration records runtime payloads, but the journal core remains domain-agnostic.

The core journal module must not depend on WhatsApp-specific types.

Runtime-specific integrations should depend on the journal contract, not the other way around.