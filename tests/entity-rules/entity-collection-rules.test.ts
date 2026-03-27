import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import {
  evaluateEntityCollection,
  listCollectedEntityIds,
  requireSingleMissingEntityPromptTarget,
} from "../../src/entity-rules/entity-collection-rules";
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

describe("entity-collection-rules", () => {
  it("lists collected entity ids deterministically", () => {
    const state = upsertSessionEntity(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      {
        entityId: " orderId ",
        value: " ORDER-55555 ",
        confidence: "confirmed",
      }
    );

    expect(listCollectedEntityIds(state)).toEqual(["orderId"]);
  });

  it("detects missing required entity for consult-order-status", () => {
    const state = createInitialSessionState({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v2",
    });

    expect(evaluateEntityCollection(loadPack(), state, "consult-order-status")).toEqual({
      intentId: "consult-order-status",
      presentEntityIds: [],
      missingEntityIds: ["orderId"],
      isComplete: false,
    });
  });

  it("detects completed entity collection for consult-order-status", () => {
    const state = upsertSessionEntity(
      createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      {
        entityId: "orderId",
        value: "ORDER-55555",
        confidence: "confirmed",
      }
    );

    expect(evaluateEntityCollection(loadPack(), state, "consult-order-status")).toEqual({
      intentId: "consult-order-status",
      presentEntityIds: ["orderId"],
      missingEntityIds: [],
      isComplete: true,
    });
  });

  it("returns the single missing prompt target deterministically", () => {
    expect(
      requireSingleMissingEntityPromptTarget({
        intentId: "consult-order-status",
        presentEntityIds: [],
        missingEntityIds: ["orderId"],
        isComplete: false,
      })
    ).toBe("orderId");
  });

  it("throws stable error when missing target is not singular", () => {
    expect(() =>
      requireSingleMissingEntityPromptTarget({
        intentId: "consult-order-status",
        presentEntityIds: [],
        missingEntityIds: [],
        isComplete: true,
      })
    ).toThrow("ENTITY_PROMPT_TARGET_NOT_SINGLE: missing=0");
  });
});
