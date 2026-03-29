import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import {
  findCanonicalResponse,
  renderCanonicalResponseText,
} from "../../src/canonical-response/canonical-response-engine";

function loadPack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-core.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

describe("canonical-response-engine", () => {
  it("finds canonical response deterministically", () => {
    expect(
      findCanonicalResponse(loadPack(), {
        intentId: " consult-order-status ",
        stage: " collect-order-id ",
        status: " missing-entity ",
      })
    ).toEqual({
      responseId: "consult-order-status-missing-order-id",
      intentId: "consult-order-status",
      stage: "collect-order-id",
      status: "missing-entity",
      messageTemplate: "Please provide your request ID so I can review the status.",
    });
  });

  it("renders canonical response text deterministically", () => {
    expect(
      renderCanonicalResponseText(loadPack(), {
        intentId: "consult-order-status",
        stage: "collect-order-id",
        status: "missing-entity",
      })
    ).toBe("Please provide your request ID so I can review the status.");
  });

  it("requires canonical response and throws stable error when missing", () => {
    expect(() =>
      renderCanonicalResponseText(loadPack(), {
        intentId: "consult-order-status",
        stage: "unknown-stage",
        status: "missing-entity",
      })
    ).toThrowError(
      'CANONICAL_RESPONSE_NOT_FOUND: intentId="consult-order-status" stage="unknown-stage" status="missing-entity"'
    );
  });
});