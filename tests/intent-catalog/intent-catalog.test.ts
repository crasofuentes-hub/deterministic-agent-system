import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../../src/business-context/context-pack";
import {
  getBusinessIntentById,
  listBusinessIntentIds,
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
      "consult-product",
      "consult-price",
      "consult-availability",
      "consult-order-status",
      "consult-policy",
      "request-human-handoff",
      "close-conversation",
    ]);
  });

  it("gets consult-price by id deterministically", () => {
    expect(getBusinessIntentById(loadPack(), "consult-price")).toEqual({
      intentId: "consult-price",
      description: "Consult the estimated premium for an insurance coverage option.",
      requiredEntities: ["productName"],
      optionalEntities: ["sku"],
      workflowId: "price-consultation-flow",
    });
  });

  it("gets consult-policy by id deterministically", () => {
    expect(getBusinessIntentById(loadPack(), "consult-policy")).toEqual({
      intentId: "consult-policy",
      description: "Consult a policy servicing topic.",
      requiredEntities: ["policyTopic"],
      optionalEntities: [],
      workflowId: "policy-consultation-flow",
    });
  });

  it("exposes stable required and optional entities through intent definitions", () => {
    const productIntent = getBusinessIntentById(loadPack(), "consult-product");
    const policyIntent = getBusinessIntentById(loadPack(), "consult-policy");
    const orderIntent = getBusinessIntentById(loadPack(), "consult-order-status");

    expect(productIntent?.optionalEntities).toEqual(["sku"]);
    expect(policyIntent?.requiredEntities).toEqual(["policyTopic"]);
    expect(policyIntent?.optionalEntities).toEqual([]);
    expect(orderIntent?.requiredEntities).toEqual(["orderId"]);
  });

  it("returns undefined for unknown intent deterministically", () => {
    expect(getBusinessIntentById(loadPack(), "unknown-intent")).toBeUndefined();
  });
});