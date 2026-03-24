import { describe, expect, it } from "vitest";
import { runCustomerServiceApiWithSession } from "../../src/customer-service-api/customer-service-api-with-session";
import { createInitialSessionState } from "../../src/session-state/session-state";

describe("customer-service-api session persistence", () => {
  it("keeps waiting-user after first incomplete turn", () => {
    const session = createInitialSessionState({
      sessionId: "S-100",
      businessContextId: "customer-service-core-v2",
    });

    const result = runCustomerServiceApiWithSession({
      session,
      userMessageText: "I want information about a product",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:00:00Z",
    });

    expect(result.output).toEqual({
      sessionId: "S-100",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the product name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
    });

    expect(result.session.conversationStatus).toBe("waiting-user");
    expect(result.session.missingEntityIds).toEqual(["productName"]);
  });

  it("resolves on second turn when the missing entity is provided", () => {
    const initial = createInitialSessionState({
      sessionId: "S-101",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceApiWithSession({
      session: initial,
      userMessageText: "I want information about a product",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:00:00Z",
    });

    const second = runCustomerServiceApiWithSession({
      session: first.session,
      userMessageText: "Laptop X Pro",
      userTurnId: "u2",
      userCreatedAtIso: "2026-03-10T10:01:00Z",
    });

    expect(second.output).toEqual({
      sessionId: "S-101",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-resolved",
      responseText:
        "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock | Summary: Laptop X Pro is a high-performance laptop for productivity and advanced workloads.",
      stage: "resolve-product",
      status: "resolved",
    });

    expect(second.session.conversationStatus).toBe("active");
    expect(second.session.missingEntityIds).toEqual([]);
    expect(second.session.collectedEntities).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("switches intent while waiting-user when the user clearly changes topic", () => {
    const initial = createInitialSessionState({
      sessionId: "S-102",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceApiWithSession({
      session: initial,
      userMessageText: "I want to know my order status",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:00:00Z",
    });

    const second = runCustomerServiceApiWithSession({
      session: first.session,
      userMessageText: "I want information about a product",
      userTurnId: "u2",
      userCreatedAtIso: "2026-03-10T10:01:00Z",
    });

    const third = runCustomerServiceApiWithSession({
      session: second.session,
      userMessageText: "Laptop X Pro",
      userTurnId: "u3",
      userCreatedAtIso: "2026-03-10T10:02:00Z",
    });

    expect(first.output).toEqual({
      sessionId: "S-102",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-missing-order-id",
      responseText: "Please provide your order ID so I can review the order status.",
      stage: "collect-order-id",
      status: "missing-entity",
    });

    expect(second.output).toEqual({
      sessionId: "S-102",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the product name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
    });

    expect(third.output).toEqual({
      sessionId: "S-102",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-resolved",
      responseText:
        "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock | Summary: Laptop X Pro is a high-performance laptop for productivity and advanced workloads.",
      stage: "resolve-product",
      status: "resolved",
    });
  });
});
