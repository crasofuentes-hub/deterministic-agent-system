import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-api session behavior", () => {
  it("keeps waiting-user state when product name is missing", () => {
    const first = runCustomerServiceApi({
      sessionId: "CS-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    expect(first.resolvedIntentId).toBe("consult-product");
    expect(first.status).toBe("missing-entity");
    expect(first.responseId).toBe("consult-product-missing-product-name");
  });

  it("resolves a follow-up product-only message using the existing waiting-user session", () => {
    runCustomerServiceApi({
      sessionId: "CS-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    const second = runCustomerServiceApi({
      sessionId: "CS-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Personal Auto Standard",
    });

    expect(second.resolvedIntentId).toBe("consult-product");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("Personal Auto Standard");
  });

  it("switches from availability to price while preserving the collected product name", () => {
    runCustomerServiceApi({
      sessionId: "CS-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Is Personal Auto Standard available?",
    });

    const second = runCustomerServiceApi({
      sessionId: "CS-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the price?",
    });

    expect(second.resolvedIntentId).toBe("consult-price");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("128.50 USD");
  });

  it("switches from product flow to human handoff cleanly", () => {
    runCustomerServiceApi({
      sessionId: "CS-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    const second = runCustomerServiceApi({
      sessionId: "CS-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want to speak to a human agent",
    });

    expect(second.resolvedIntentId).toBe("request-human-handoff");
    expect(second.status).toBe("handoff");
    expect(second.humanInterventionRequired).toBe(true);
    expect(second.handoffReasonCode).toBe("explicit-human-request");
    expect(second.handoffQueue).toBe("licensed-broker");
  });

  it("switches cleanly from waiting order-status flow to product flow", () => {
    runCustomerServiceApi({
      sessionId: "CS-005",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of my order?",
    });

    const second = runCustomerServiceApi({
      sessionId: "CS-005",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Personal Auto Standard",
    });

    expect(second.resolvedIntentId).toBe("consult-product");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("Personal Auto Standard");
  });

  it("switches cleanly from waiting product flow to order-status flow", () => {
    runCustomerServiceApi({
      sessionId: "CS-006",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    const second = runCustomerServiceApi({
      sessionId: "CS-006",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-12345?",
    });

    expect(second.resolvedIntentId).toBe("consult-order-status");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toContain("ORDER-12345");
  });
});