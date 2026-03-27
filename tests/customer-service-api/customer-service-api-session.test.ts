import { describe, expect, it } from "vitest";
import { runCustomerServiceAgent } from "../../src/customer-service-agent/customer-service-agent";
import { createInitialSessionState } from "../../src/session-state/session-state";

describe("customer-service-api session behavior", () => {
  it("keeps waiting-user state when product name is missing", () => {
    const session = createInitialSessionState({
      sessionId: "session-001",
      businessContextId: "customer-service-core-v2",
    });

    const result = runCustomerServiceAgent({
      session,
      userMessageText: "I need product information",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.status).toBe("missing-entity");
    expect(result.session.conversationStatus).toBe("waiting-user");
    expect(result.session.missingEntityIds).toEqual(["productName"]);
  });

  it("resolves a follow-up product-only message using the existing waiting-user session", () => {
    const session = createInitialSessionState({
      sessionId: "session-002",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceAgent({
      session,
      userMessageText: "I need product information",
    });

    const second = runCustomerServiceAgent({
      session: first.session,
      userMessageText: "Laptop X Pro",
    });

    expect(first.status).toBe("missing-entity");
    expect(second.resolvedIntentId).toBe("consult-product");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("Laptop X Pro");
    expect(second.session.conversationStatus).toBe("active");
  });

  it("switches from availability to price while preserving the collected product name", () => {
    const session = createInitialSessionState({
      sessionId: "session-003",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceAgent({
      session,
      userMessageText: "Do you have Laptop X Pro?",
    });

    const second = runCustomerServiceAgent({
      session: first.session,
      userMessageText: "How much does it cost?",
    });

    expect(first.resolvedIntentId).toBe("consult-availability");
    expect(first.status).toBe("resolved");
    expect(first.session.collectedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "productName",
          value: "Laptop X Pro",
        }),
      ])
    );

    expect(second.resolvedIntentId).toBe("consult-price");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("1499.99 USD");
    expect(second.session.collectedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "productName",
          value: "Laptop X Pro",
        }),
      ])
    );
  });

  it("switches from product flow to human handoff cleanly", () => {
    const session = createInitialSessionState({
      sessionId: "session-004",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceAgent({
      session,
      userMessageText: "Can you tell me about Laptop X Pro?",
    });

    const second = runCustomerServiceAgent({
      session: first.session,
      userMessageText: "I want to talk to an agent",
    });

    expect(first.resolvedIntentId).toBe("consult-product");
    expect(first.status).toBe("resolved");

    expect(second.resolvedIntentId).toBe("request-human-handoff");
    expect(second.status).toBe("handoff");
    expect(second.session.conversationStatus).toBe("handoff-requested");
  });
});
