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

    expect(pack.contextId).toBe("customer-service-core-v2");
    expect(pack.domain).toBe("insurance-brokerage");
    expect(pack.businessName).toBe("Northwind Insurance Brokers");

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

  it("defines consult-product with required productName", () => {
    const filePath = path.resolve(
      process.cwd(),
      "config/business-context/customer-service-core.json"
    );

    const raw = fs.readFileSync(filePath, "utf8");
    const pack = JSON.parse(raw);

    const intent = pack.supportedIntents.find(
      (item: { intentId: string }) => item.intentId === "consult-product"
    );

    expect(intent).toEqual({
      intentId: "consult-product",
      description: "Consult information about an insurance coverage option.",
      requiredEntities: ["productName"],
      optionalEntities: ["sku"],
      workflowId: "product-consultation-flow"
    });
  });

  it("defines consult-order-status with required orderId", () => {
    const filePath = path.resolve(
      process.cwd(),
      "config/business-context/customer-service-core.json"
    );

    const raw = fs.readFileSync(filePath, "utf8");
    const pack = JSON.parse(raw);

    const intent = pack.supportedIntents.find(
      (item: { intentId: string }) => item.intentId === "consult-order-status"
    );

    expect(intent).toEqual({
      intentId: "consult-order-status",
      description: "Consult the status of an insurance application or servicing request.",
      requiredEntities: ["orderId"],
      optionalEntities: [],
      workflowId: "order-status-flow"
    });
  });
});