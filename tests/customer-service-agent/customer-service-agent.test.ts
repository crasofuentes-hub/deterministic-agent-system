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

  it("resolves price when product name is present in user text", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Cual es el precio de laptop x pro",
    });

    expect(result.resolvedIntentId).toBe("consult-price");
    expect(result.responseId).toBe("consult-price-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("The product price has been retrieved.");
  });

  it("resolves order status when order id is present in user text", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Quiero saber el estado de mi pedido ORDER-12345",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("Your order status has been retrieved.");
  });

  it("requests human handoff deterministically", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Quiero hablar con un humano",
    });

    expect(result.resolvedIntentId).toBe("request-human-handoff");
    expect(result.responseId).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
  });
});