import { describe, expect, it } from "vitest";
import { extractEntitiesFromText } from "../../src/entity-extractor/entity-extractor";

describe("entity-extractor", () => {
  it("extracts orderId deterministically", () => {
    expect(
      extractEntitiesFromText("Quiero saber el estado de mi pedido ORDER-12345")
    ).toEqual([
      {
        entityId: "orderId",
        value: "ORDER-12345",
        confidence: "derived",
      },
    ]);
  });

  it("extracts productName deterministically", () => {
    expect(
      extractEntitiesFromText("Cual es el precio de laptop x pro")
    ).toEqual([
      {
        entityId: "productName",
        value: "laptop x pro",
        confidence: "derived",
      },
    ]);
  });

  it("extracts both entities when present", () => {
    expect(
      extractEntitiesFromText("Necesito laptop x y mi order ABCD-9999")
    ).toEqual([
      {
        entityId: "orderId",
        value: "ABCD-9999",
        confidence: "derived",
      },
      {
        entityId: "productName",
        value: "laptop x y mi order ABCD-9999",
        confidence: "derived",
      },
    ]);
  });
});