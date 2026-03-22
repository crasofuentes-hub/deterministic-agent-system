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
  it("asks for missing caseId deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      intentId: "consult-status",
    });

    expect(result.responseId).toBe("consult-status-missing-case-id");
    expect(result.stage).toBe("collect-case-id");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide your case ID so I can review the status."
    );
    expect(result.session.conversationStatus).toBe("waiting-user");
    expect(result.session.missingEntityIds).toEqual(["caseId"]);
  });

  it("resolves consult-status when caseId is present", () => {
    const session = upsertSessionEntity(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      {
        entityId: "caseId",
        value: "CASE-123",
        confidence: "confirmed",
      }
    );

    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session,
      intentId: "consult-status",
    });

    expect(result.responseId).toBe("consult-status-resolved");
    expect(result.stage).toBe("resolve-status");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe("Your case status has been retrieved.");
    expect(result.session.conversationStatus).toBe("active");
    expect(result.session.missingEntityIds).toEqual([]);
  });

  it("requests human handoff deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      intentId: "request-human-handoff",
    });

    expect(result.responseId).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
    expect(result.responseText).toBe(
      "Your conversation will be transferred to a human agent."
    );
    expect(result.session.handoffRequested).toBe(true);
    expect(result.session.conversationStatus).toBe("handoff-requested");
  });

  it("closes conversation deterministically", () => {
    const result = orchestrateConversationTurn({
      pack: loadPack(),
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      intentId: "close-conversation",
    });

    expect(result.responseId).toBe("conversation-closed");
    expect(result.status).toBe("closed");
    expect(result.responseText).toBe("Your conversation has been closed.");
    expect(result.session.conversationStatus).toBe("closed");
  });
});