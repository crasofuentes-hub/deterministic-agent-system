import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-agent e2e", () => {
  it("returns real price data end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the price of Laptop X Pro?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:00:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-price",
      responseId: "consult-price-resolved",
      responseText: "Product: Laptop X Pro | Price: 1499.99 USD",
      stage: "resolve-price",
      status: "resolved",
    });
  });

  it("returns real order status end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-12345?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:05:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-002",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "Order ORDER-12345 is currently processing. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time.",
      stage: "resolve-order-status",
      status: "resolved",
    });
  });

  it("persists session across turns and returns real product knowledge", () => {
    const first = runCustomerServiceApi({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:10:00Z",
    });

    expect(first).toEqual({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the product name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
    });

    const second = runCustomerServiceApi({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Laptop X Pro",
      userTurnId: "u2",
      userCreatedAtIso: "2026-03-10T10:11:00Z",
    });

    expect(second).toEqual({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-resolved",
      responseText: "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock | Summary: Laptop X Pro is a high-performance laptop for productivity and advanced workloads.",
      stage: "resolve-product",
      status: "resolved",
    });
  });

  it("returns canonical order-not-found response end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-00000?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:12:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-004",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "I could not find an order with the provided order ID. Please verify the order ID and try again.",
      stage: "resolve-order-status",
      status: "resolved",
    });
  });
});