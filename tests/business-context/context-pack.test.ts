import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("business context pack", () => {
  it("loads customer-service-core pack with stable structure", () => {
    const filePath = path.resolve(
      process.cwd(),
      "config/business-context/customer-service-core.json"
    );

    const raw = fs.readFileSync(filePath, "utf8");
    const pack = JSON.parse(raw);

    expect(pack.contextId).toBe("customer-service-core-v1");
    expect(pack.domain).toBe("customer-service");
    expect(pack.businessName).toBe("Generic Customer Service");

    expect(Array.isArray(pack.supportedIntents)).toBe(true);
    expect(Array.isArray(pack.entitySchema)).toBe(true);
    expect(Array.isArray(pack.workflowRules)).toBe(true);
    expect(Array.isArray(pack.canonicalResponses)).toBe(true);
    expect(Array.isArray(pack.handoffRules)).toBe(true);

    expect(pack.tonePolicy).toEqual({
      toneId: "default-neutral",
      style: "neutral",
      brevity: "medium"
    });

    expect(pack.sessionPolicy).toEqual({
      inactivityTimeoutMinutes: 30,
      allowResume: true,
      maxTurnsBeforeClosure: 100
    });
  });

  it("defines consult-status intent with required caseId", () => {
    const filePath = path.resolve(
      process.cwd(),
      "config/business-context/customer-service-core.json"
    );

    const raw = fs.readFileSync(filePath, "utf8");
    const pack = JSON.parse(raw);

    const intent = pack.supportedIntents.find(
      (item: { intentId: string }) => item.intentId === "consult-status"
    );

    expect(intent).toEqual({
      intentId: "consult-status",
      description: "Consult the status of an existing case or request.",
      requiredEntities: ["caseId"],
      optionalEntities: [],
      workflowId: "case-status-flow"
    });
  });
});