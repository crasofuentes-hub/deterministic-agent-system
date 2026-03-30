import { describe, expect, it } from "vitest";
import { runCustomerServiceAgent } from "../../src/customer-service-agent/customer-service-agent";
import { createInitialSessionState } from "../../src/session-state/session-state";

describe("customer-service-agent", () => {
  it("asks for coverage option name when missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I want information about a product",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-missing-product-name");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the coverage option name so I can help you."
    );
  });

  it("returns real coverage option knowledge and product data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need Personal Auto Standard",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Product: Personal Auto Standard | SKU: AUTO-PERS-STD | Price: 128.50 USD | Availability: eligible | Summary: Personal Auto Standard is an entry-level personal auto coverage option for everyday drivers seeking basic liability and property damage protection."
    );
  });

  it("returns real estimated premium data when coverage option name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-002",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the price of Personal Auto Standard?",
    });

    expect(result.resolvedIntentId).toBe("consult-price");
    expect(result.responseText).toBe("Product: Personal Auto Standard | Price: 128.50 USD");
  });

  it("returns rich broker eligibility data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-003",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Is General Liability Core eligible?",
    });

    expect(result.resolvedIntentId).toBe("consult-availability");
    expect(result.responseText).toBe(
      "Product: General Liability Core | Availability: broker-review | Eligibility: broker-review-required | Broker Review Required: True | Underwriting Review Required: False | Additional Documents Required: False | Notes: Broker review is required before this coverage option can be confirmed."
        .replace("True", "true")
        .replace("False", "false")
        .replace("False", "false")
    );
  });

  it("returns real request status data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-004",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-12345?",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseText).toBe(
      "Order ORDER-12345 is currently under-review. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time."
    );
  });

  it("returns canonical request-not-found response", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-005",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-00000?",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "I could not find an order with the provided order ID. Please verify the order ID and try again."
    );
  });

  it("returns canonical invalid-request-id response", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-006",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-??",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "The provided order ID format is invalid. Please provide a valid order ID and try again."
    );
  });
});