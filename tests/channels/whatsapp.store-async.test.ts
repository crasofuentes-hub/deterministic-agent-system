import { describe, expect, it } from "vitest";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";

describe("async whatsapp store contract", () => {
  it("adapts session operations from the existing sync store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);

    const session = await store.loadSession("5215512345678");
    const updated = {
      ...session,
      currentIntentId: "consult-coverage",
      currentStage: "resolve-coverage",
    };

    await store.saveSession("5215512345678", updated);

    await expect(store.loadSession("5215512345678")).resolves.toEqual(updated);
  });

  it("adapts processed message operations from the existing sync store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);

    await expect(store.hasProcessedMessage("wamid.async.001")).resolves.toBe(false);

    await store.markMessageProcessed("wamid.async.001");
    await store.markMessageProcessed("wamid.async.001");

    await expect(store.hasProcessedMessage("wamid.async.001")).resolves.toBe(true);
  });

  it("adapts evidence operations from the existing sync store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);

    await expect(store.loadEvidence("5215512345678")).resolves.toBeUndefined();

    await store.saveEvidence({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.coverage.001",
      lastResponseId: "consult-coverage-resolved",
      lastResolvedIntentId: "consult-coverage",
      lastStage: "resolve-coverage",
      lastStatus: "resolved",
      lastOutboundText: "Policy NMA-****-1001 for Maria Alvarez",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });

    await expect(store.loadEvidence("5215512345678")).resolves.toEqual({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.coverage.001",
      lastResponseId: "consult-coverage-resolved",
      lastResolvedIntentId: "consult-coverage",
      lastStage: "resolve-coverage",
      lastStatus: "resolved",
      lastOutboundText: "Policy NMA-****-1001 for Maria Alvarez",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("adapts handoff operations from the existing sync store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);

    await expect(store.listHandoffs()).resolves.toEqual([]);

    await store.saveHandoff({
      handoffId: "handoff:5215512345678:wamid.handoff.001",
      customerId: "5215512345678",
      createdAtIso: "2026-03-24T00:00:00.000Z",
      updatedAtIso: "2026-03-24T00:00:00.000Z",
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "licensed-broker",
      status: "open",
      lastInboundMessageId: "wamid.handoff.001",
      lastResponseId: "handoff-requested",
      lastResolvedIntentId: "request-human-handoff",
      lastStage: "handoff-requested",
      lastStatus: "handoff",
      lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
    });

    await expect(store.listHandoffs()).resolves.toEqual([
      {
        handoffId: "handoff:5215512345678:wamid.handoff.001",
        customerId: "5215512345678",
        createdAtIso: "2026-03-24T00:00:00.000Z",
        updatedAtIso: "2026-03-24T00:00:00.000Z",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
        status: "open",
        lastInboundMessageId: "wamid.handoff.001",
        lastResponseId: "handoff-requested",
        lastResolvedIntentId: "request-human-handoff",
        lastStage: "handoff-requested",
        lastStatus: "handoff",
        lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
      },
    ]);
  });

  it("adapts conversation event operations from the existing sync store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);

    await expect(store.listConversationEvents("5215512345678")).resolves.toEqual([]);

    await store.saveConversationEvent({
      eventId: "event:5215512345678:002",
      customerId: "5215512345678",
      occurredAtIso: "2026-03-24T00:00:01.000Z",
      kind: "outbound",
      channelMessageId: "wamid.async.001",
      responseId: "consult-coverage-resolved",
      resolvedIntentId: "consult-coverage",
      stage: "resolve-coverage",
      status: "resolved",
      text: "Policy NMA-****-1001 for Maria Alvarez",
    });

    await store.saveConversationEvent({
      eventId: "event:5215512345678:001",
      customerId: "5215512345678",
      occurredAtIso: "2026-03-24T00:00:00.000Z",
      kind: "inbound",
      channelMessageId: "wamid.async.001",
      text: "Coverage details for POL-AUTO-1001",
    });

    await expect(store.listConversationEvents("5215512345678")).resolves.toEqual([
      {
        eventId: "event:5215512345678:001",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "inbound",
        channelMessageId: "wamid.async.001",
        text: "Coverage details for POL-AUTO-1001",
        responseId: undefined,
        resolvedIntentId: undefined,
        stage: undefined,
        status: undefined,
        handoffId: undefined,
        handoffReasonCode: undefined,
        handoffQueue: undefined,
      },
      {
        eventId: "event:5215512345678:002",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:01.000Z",
        kind: "outbound",
        channelMessageId: "wamid.async.001",
        responseId: "consult-coverage-resolved",
        resolvedIntentId: "consult-coverage",
        stage: "resolve-coverage",
        status: "resolved",
        text: "Policy NMA-****-1001 for Maria Alvarez",
        handoffId: undefined,
        handoffReasonCode: undefined,
        handoffQueue: undefined,
      },
    ]);
  });
});