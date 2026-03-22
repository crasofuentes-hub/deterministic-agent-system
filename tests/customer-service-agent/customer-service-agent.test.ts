import { describe, expect, it } from "vitest";
import { runCustomerServiceAgent } from "../../src/customer-service-agent/customer-service-agent";
import { createInitialSessionState } from "../../src/session-state/session-state";

describe("customer-service-agent", () => {
  it("asks for product name when missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Quiero informacion de un producto",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-missing-product-name");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe("Please provide the product name so I can help you.");
  });

  it("returns real knowledge and product data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Necesito Laptop X Pro",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock | Summary: Laptop X Pro is a high-performance laptop for productivity and advanced workloads."
    );
  });

  it("returns real price data when product name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-002",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Cual es el precio de Laptop X Pro",
    });

    expect(result.resolvedIntentId).toBe("consult-price");
    expect(result.responseText).toBe("Product: Laptop X Pro | Price: 1499.99 USD");
  });

  it("returns real availability data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-003",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Tienen disponibilidad de Laptop X Pro",
    });

    expect(result.resolvedIntentId).toBe("consult-availability");
    expect(result.responseText).toBe("Product: Laptop X Pro | Availability: in-stock | Stock: 12");
  });

  it("returns real order status data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-004",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Quiero saber el estado de mi pedido ORDER-12345",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseText).toBe("Order ID: ORDER-12345 | Status: processing | Updated: 2026-03-10T10:00:00Z");
  });
});