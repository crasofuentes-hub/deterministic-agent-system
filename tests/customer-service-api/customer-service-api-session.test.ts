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
      userMessageText: "Quiero informacion de un producto",
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

  it("resolves on second turn when missing entity is provided", () => {
    const initial = createInitialSessionState({
      sessionId: "S-101",
      businessContextId: "customer-service-core-v2",
    });

    const first = runCustomerServiceApiWithSession({
      session: initial,
      userMessageText: "Quiero informacion de un producto",
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
      responseText: "The product information has been retrieved.",
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
});