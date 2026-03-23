import { describe, expect, it } from "vitest";
import { extractEntitiesFromText } from "../../src/entity-extractor/entity-extractor";

describe("entity-extractor", () => {
  it("extracts orderId deterministically", () => {
    expect(
      extractEntitiesFromText("I want to check the status of order ORDER-12345")
    ).toEqual([
      {
        entityId: "orderId",
        value: "ORDER-12345",
        confidence: "derived",
      },
    ]);
  });

  it("extracts productName deterministically from pricing question", () => {
    expect(
      extractEntitiesFromText("What is the price of Laptop X Pro")
    ).toEqual([
      {
        entityId: "productName",
        value: "Laptop X Pro",
        confidence: "derived",
      },
    ]);
  });

  it("extracts bare product name deterministically for follow-up turns", () => {
    expect(
      extractEntitiesFromText("Laptop X Pro")
    ).toEqual([
      {
        entityId: "productName",
        value: "Laptop X Pro",
        confidence: "derived",
      },
    ]);
  });
});