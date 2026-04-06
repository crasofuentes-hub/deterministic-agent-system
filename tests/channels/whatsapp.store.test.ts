import { describe, expect, it } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";

describe("whatsapp store", () => {
  it("creates deterministic initial session when none exists", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const session = store.loadSession("5215512345678");
    expect(session).toEqual({
      sessionId: "whatsapp-session:5215512345678",
      businessContextId: "customer-service-core-v2",
      currentIntentId: undefined,
      currentWorkflowId: undefined,
      currentStage: undefined,
      conversationStatus: "active",
      missingEntityIds: [],
      collectedEntities: [],
      turns: [],
      handoffRequested: false,
    });
  });

  it("persists saved session by customer id", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const session = store.loadSession("5215512345678");
    const updated = {
      ...session,
      currentIntentId: "consult-price",
      conversationStatus: "waiting-user" as const,
      missingEntityIds: ["productName"],
    };
    store.saveSession("5215512345678", updated);
    expect(store.loadSession("5215512345678")).toEqual(updated);
  });

  it("tracks processed channel message ids idempotently", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    expect(store.hasProcessedMessage("wamid.001")).toBe(false);
    store.markMessageProcessed("wamid.001");
    store.markMessageProcessed("wamid.001");
    expect(store.hasProcessedMessage("wamid.001")).toBe(true);
  });

  it("supports custom session id prefix", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
      sessionIdPrefix: "wa-session",
    });
    const session = store.loadSession("5215512345678");
    expect(session.sessionId).toBe("wa-session:5215512345678");
  });

  it("rejects invalid businessContextId", () => {
    expect(() =>
      createInMemoryWhatsAppStore({
        businessContextId: " ",
      })
    ).toThrow("businessContextId must be a non-empty string");
  });

  it("persists last conversation evidence by customer id", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    expect(store.loadEvidence("5215512345678")).toBeUndefined();

    store.saveEvidence({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.quote.005",
      lastResponseId: "request-quote-resolved",
      lastResolvedIntentId: "request-quote",
      lastStage: "resolve-quote-intake",
      lastStatus: "resolved",
      lastOutboundText: "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Prior insurance status: insured. Driver count: 2. Preferred contact: call.",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });

    expect(store.loadEvidence("5215512345678")).toEqual({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.quote.005",
      lastResponseId: "request-quote-resolved",
      lastResolvedIntentId: "request-quote",
      lastStage: "resolve-quote-intake",
      lastStatus: "resolved",
      lastOutboundText: "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Prior insurance status: insured. Driver count: 2. Preferred contact: call.",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("persists handoff queue records in memory", () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    expect(store.listHandoffs()).toEqual([]);

    store.saveHandoff({
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

    expect(store.listHandoffs()).toEqual([
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
});