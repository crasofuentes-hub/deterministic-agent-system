import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import {
  findCanonicalResponse,
  renderCanonicalResponseText,
  requireCanonicalResponse,
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
      messageTemplate: "Please provide your order ID so I can review the order status.",
    });
  });

  it("renders canonical response text deterministically", () => {
    expect(
      renderCanonicalResponseText(loadPack(), {
        intentId: "consult-order-status",
        stage: "collect-order-id",
        status: "missing-entity",
      })
    ).toBe("Please provide your order ID so I can review the order status.");
  });

  it("requires canonical response and throws stable error when missing", () => {
    expect(() =>
      requireCanonicalResponse(loadPack(), {
        intentId: "consult-order-status",
        stage: "done",
        status: "unknown-status",
      })
    ).toThrow(
      'CANONICAL_RESPONSE_NOT_FOUND: intentId="consult-order-status" stage="done" status="unknown-status"'
    );
  });
});
