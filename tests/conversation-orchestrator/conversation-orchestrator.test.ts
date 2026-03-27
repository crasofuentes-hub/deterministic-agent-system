import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import { orchestrateConversationTurn } from "../../src/conversation-orchestrator/conversation-orchestrator";
import {
  createInitialSessionState,
  upsertSessionEntity,
} from "../../src/session-state/session-state";

function loadPack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-core.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

describe("conversation-orchestrator", () => {
  it("asks for missing product name deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "consult-product",
    });

    expect(result.responseId).toBe("consult-product-missing-product-name");
    expect(result.stage).toBe("collect-product-name");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the product name so I can help you."
    );
    expect(result.session.conversationStatus).toBe("waiting-user");
    expect(result.session.missingEntityIds).toEqual(["productName"]);
  });

  it("resolves consult-price when productName is present", () => {
    const session = upsertSessionEntity(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      {
        entityId: "productName",
        value: "Laptop X",
        confidence: "confirmed",
      }
    );

    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session,
      intentId: "consult-price",
    });

    expect(result.responseId).toBe("consult-price-resolved");
    expect(result.stage).toBe("resolve-price");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("The product price has been retrieved.");
    expect(result.session.conversationStatus).toBe("active");
    expect(result.session.missingEntityIds).toEqual([]);
  });

  it("asks for missing orderId deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "consult-order-status",
    });

    expect(result.responseId).toBe("consult-order-status-missing-order-id");
    expect(result.stage).toBe("collect-order-id");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide your order ID so I can review the order status."
    );
    expect(result.session.missingEntityIds).toEqual(["orderId"]);
  });

  it("requests human handoff deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "request-human-handoff",
    });

    expect(result.responseId).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
    expect(result.responseText).toBe(
      "Your conversation will be transferred to a human agent."
    );
    expect(result.session.handoffRequested).toBe(true);
    expect(result.session.handoffReasonCode).toBe("explicit-human-request");
    expect(result.session.handoffQueue).toBe("general");
    expect(result.session.conversationStatus).toBe("handoff-requested");
  });

  it("closes conversation deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      intentId: "close-conversation",
    });

    expect(result.responseId).toBe("conversation-closed");
    expect(result.status).toBe("closed");
    expect(result.responseText).toBe("Your conversation has been closed.");
    expect(result.session.conversationStatus).toBe("closed");
  });
});