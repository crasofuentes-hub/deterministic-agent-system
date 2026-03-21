import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import {
  getBusinessIntentById,
  listBusinessIntentIds,
  listOptionalEntityIdsForIntent,
  listRequiredEntityIdsForIntent,
  requireBusinessIntentById,
} from "../../src/intent-catalog/intent-catalog";

function loadPack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-core.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

describe("intent-catalog", () => {
  it("lists stable intent ids", () => {
    expect(listBusinessIntentIds(loadPack())).toEqual([
      "consult-status",
      "request-human-handoff",
      "close-conversation",
    ]);
  });

  it("gets intent by id deterministically", () => {
    expect(getBusinessIntentById(loadPack(), " consult-status ")).toEqual({
      intentId: "consult-status",
      description: "Consult the status of an existing case or request.",
      requiredEntities: ["caseId"],
      optionalEntities: [],
      workflowId: "case-status-flow",
    });
  });

  it("lists required entities deterministically", () => {
    expect(
      listRequiredEntityIdsForIntent(loadPack(), "consult-status")
    ).toEqual(["caseId"]);
  });

  it("lists optional entities deterministically", () => {
    expect(
      listOptionalEntityIdsForIntent(loadPack(), "consult-status")
    ).toEqual([]);
  });

  it("throws stable error for unknown intent", () => {
    expect(() =>
      requireBusinessIntentById(loadPack(), "unknown-intent")
    ).toThrow('BUSINESS_INTENT_NOT_FOUND: intentId="unknown-intent"');
  });
});