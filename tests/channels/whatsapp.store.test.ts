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

    expect(store.hasProcessedMessage("wamid.001")).toBe(true);

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
        businessContextId: "   ",
      })
    ).toThrow("businessContextId must be a non-empty string");
  });
});
