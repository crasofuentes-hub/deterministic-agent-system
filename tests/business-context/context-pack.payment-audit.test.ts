import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("business context pack - payment audit", () => {
  function loadPack(): any {
    const filePath = path.resolve(
      process.cwd(),
      "config/business-context/customer-service-payment-audit.json"
    );

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  }

  it("loads payment audit pack with stable structure", () => {
    const pack = loadPack();

    expect(pack.contextId).toBe("customer-service-payment-audit-v1");
    expect(pack.domain).toBe("insurance-payment-audit");
    expect(pack.businessName).toBe("Freeway Franchise Insurance Operations");

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

  it("defines consult-payment-status with required paymentId", () => {
    const pack = loadPack();

    const intent = pack.supportedIntents.find(
      (item: { intentId: string }) => item.intentId === "consult-payment-status"
    );

    expect(intent).toEqual({
      intentId: "consult-payment-status",
      description: "Consult the current status of an insurance payment.",
      requiredEntities: ["paymentId"],
      optionalEntities: ["policyId", "customerId"],
      workflowId: "payment-status-flow"
    });
  });

  it("defines consult-policy-servicing with required billingTopic", () => {
    const pack = loadPack();

    const intent = pack.supportedIntents.find(
      (item: { intentId: string }) => item.intentId === "consult-policy-servicing"
    );

    expect(intent).toEqual({
      intentId: "consult-policy-servicing",
      description: "Consult a policy servicing or billing topic.",
      requiredEntities: ["billingTopic"],
      optionalEntities: ["policyId", "customerId"],
      workflowId: "policy-servicing-flow"
    });
  });
});