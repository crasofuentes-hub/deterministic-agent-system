import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-api", () => {
  it("returns missing-entity response for incomplete product consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    expect(result).toEqual({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the product name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
    });
  });

  it("returns resolved response for order-status consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-12345?",
    });

    expect(result).toEqual({
      sessionId: "S-002",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "Order ORDER-12345 is currently processing. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time.",
      stage: "resolve-order-status",
      status: "resolved",
    });
  });
});