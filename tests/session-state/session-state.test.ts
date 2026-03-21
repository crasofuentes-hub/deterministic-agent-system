import { describe, expect, it } from "vitest";
import {
  appendSessionTurn,
  closeSessionState,
  createInitialSessionState,
  requestHumanHandoff,
  setSessionIntent,
  upsertSessionEntity,
} from "../../src/session-state/session-state";

describe("session-state", () => {
  it("creates deterministic initial session state", () => {
    expect(
      createInitialSessionState({
        sessionId: "  S-001  ",
        businessContextId: " customer-service-core-v1 ",
      })
    ).toEqual({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v1",
      conversationStatus: "active",
      collectedEntities: [],
      missingEntityIds: [],
      handoffRequested: false,
      turns: [],
    });
  });

  it("appends normalized turns", () => {
    const state = createInitialSessionState({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v1",
    });

    expect(
      appendSessionTurn(state, {
        turnId: "  T-001 ",
        speaker: "user",
        messageText: "  Hola, necesito ayuda ",
        createdAtIso: " 2026-03-10T10:00:00Z ",
      }).turns
    ).toEqual([
      {
        turnId: "T-001",
        speaker: "user",
        messageText: "Hola, necesito ayuda",
        createdAtIso: "2026-03-10T10:00:00Z",
      },
    ]);
  });

  it("upserts entities and removes them from missing list", () => {
    const base = setSessionIntent(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      {
        intentId: "consult-status",
        workflowId: "case-status-flow",
        stage: "collect-case-id",
        missingEntityIds: ["caseId"],
      }
    );

    const updated = upsertSessionEntity(base, {
      entityId: " caseId ",
      value: " CASE-123 ",
      confidence: "confirmed",
    });

    expect(updated.collectedEntities).toEqual([
      {
        entityId: "caseId",
        value: "CASE-123",
        confidence: "confirmed",
      },
    ]);

    expect(updated.missingEntityIds).toEqual([]);
  });

  it("sets waiting-user when entities are missing", () => {
    const state = setSessionIntent(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      {
        intentId: "consult-status",
        workflowId: "case-status-flow",
        stage: "collect-case-id",
        missingEntityIds: ["caseId"],
      }
    );

    expect(state.currentIntentId).toBe("consult-status");
    expect(state.currentWorkflowId).toBe("case-status-flow");
    expect(state.currentStage).toBe("collect-case-id");
    expect(state.conversationStatus).toBe("waiting-user");
  });

  it("sets active when no entities are missing", () => {
    const state = setSessionIntent(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      }),
      {
        intentId: "close-conversation",
        workflowId: "closure-flow",
        stage: "done",
        missingEntityIds: [],
      }
    );

    expect(state.conversationStatus).toBe("active");
  });

  it("requests human handoff deterministically", () => {
    const state = requestHumanHandoff(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      })
    );

    expect(state.handoffRequested).toBe(true);
    expect(state.conversationStatus).toBe("handoff-requested");
  });

  it("closes session deterministically", () => {
    const state = closeSessionState(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v1",
      })
    );

    expect(state.conversationStatus).toBe("closed");
  });
});