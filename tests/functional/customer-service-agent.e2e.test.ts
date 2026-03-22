import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-agent e2e", () => {
  it("returns real price data end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Cual es el precio de Laptop X Pro",
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
      userMessageText: "Quiero saber el estado de mi pedido ORDER-12345",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:05:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-002",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "Order ID: ORDER-12345 | Status: processing | Updated: 2026-03-10T10:00:00Z",
      stage: "resolve-order-status",
      status: "resolved",
    });
  });

  it("persists session across turns end-to-end", () => {
    const first = runCustomerServiceApi({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Quiero informacion de un producto",
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
      responseText: "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock",
      stage: "resolve-product",
      status: "resolved",
    });
  });
});