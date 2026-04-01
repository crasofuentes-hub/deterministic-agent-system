import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import { orchestrateConversationTurn } from "../../src/conversation-orchestrator/conversation-orchestrator";
import { createInitialSessionState } from "../../src/session-state/session-state";

function loadLegacyPack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-core.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

function loadPaymentAuditPack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-payment-audit.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

describe("conversation-orchestrator", () => {
  it("asks for missing product name deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadLegacyPack(),
      session: createInitialSessionState({
        sessionId: "CO-001",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "consult-product",
    });

    expect(result.responseId).toBe("consult-product-missing-product-name");
    expect(result.stage).toBe("collect-product-name");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the coverage option name so I can help you."
    );
  });

  it("resolves consult-price when productName is present", () => {
    const session = {
      ...createInitialSessionState({
        sessionId: "CO-002",
        businessContextId: "customer-service-core-v2",
      }),
      collectedEntities: [
        {
          entityId: "productName",
          value: "Personal Auto Standard",
          confidence: "confirmed",
        },
      ],
    };

    const result = orchestrateConversationTurn({
      pack: loadLegacyPack(),
      session,
      intentId: "consult-price",
    });

    expect(result.responseId).toBe("consult-price-resolved");
    expect(result.stage).toBe("resolve-price");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("The estimated premium information has been retrieved.");
    expect(result.session.conversationStatus).toBe("active");
    expect(result.session.missingEntityIds).toEqual([]);
  });

  it("asks for missing orderId deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadLegacyPack(),
      session: createInitialSessionState({
        sessionId: "CO-003",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "consult-order-status",
    });

    expect(result.responseId).toBe("consult-order-status-missing-order-id");
    expect(result.stage).toBe("collect-order-id");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide your request ID so I can review the status."
    );
  });

  it("requests human handoff deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadLegacyPack(),
      session: createInitialSessionState({
        sessionId: "CO-004",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "request-human-handoff",
    });

    expect(result.responseId).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
    expect(result.responseText).toBe(
      "Your conversation will be transferred to a licensed broker specialist."
    );
    expect(result.session.handoffRequested).toBe(true);
    expect(result.session.handoffReasonCode).toBe("explicit-human-request");
    expect(result.session.handoffQueue).toBe("licensed-broker");
  });

  it("closes conversation deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadLegacyPack(),
      session: createInitialSessionState({
        sessionId: "CO-005",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "close-conversation",
    });

    expect(result.responseId).toBe("conversation-closed");
    expect(result.stage).toBe("done");
    expect(result.status).toBe("closed");
    expect(result.responseText).toBe("Your conversation has been closed.");
  });

  it("asks for missing payment id deterministically in payment audit context", () => {
    const result = orchestrateConversationTurn({
      pack: loadPaymentAuditPack(),
      session: createInitialSessionState({
        sessionId: "CO-006",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      intentId: "consult-payment-status",
    });

    expect(result.responseId).toBe("consult-payment-status-missing-payment-id");
    expect(result.stage).toBe("collect-payment-id");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the payment ID so I can review the payment status."
    );
  });

  it("resolves policy servicing deterministically in payment audit context", () => {
    const session = {
      ...createInitialSessionState({
        sessionId: "CO-007",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      collectedEntities: [
        {
          entityId: "billingTopic",
          value: "document delivery",
          confidence: "confirmed",
        },
      ],
    };

    const result = orchestrateConversationTurn({
      pack: loadPaymentAuditPack(),
      session,
      intentId: "consult-policy-servicing",
    });

    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.stage).toBe("resolve-policy-servicing");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("The policy servicing information has been retrieved.");
  });
});