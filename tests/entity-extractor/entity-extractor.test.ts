import { describe, expect, it } from "vitest";
import { extractEntitiesFromText } from "../../src/entity-extractor/entity-extractor";

describe("entity-extractor", () => {
  it("extracts orderId from English order-status message", () => {
    expect(extractEntitiesFromText("What is the status of my order ORDER-55555?")).toContainEqual({
      entityId: "orderId",
      value: "ORDER-55555",
      confidence: "derived",
    });
  });

  it("extracts orderId from Spanish order-status message", () => {
    expect(extractEntitiesFromText("Cuál es el estado de mi orden ORDER-55555")).toContainEqual({
      entityId: "orderId",
      value: "ORDER-55555",
      confidence: "derived",
    });
  });

  it("extracts productName from English price message", () => {
    expect(extractEntitiesFromText("I want to know the price of Laptop X Pro")).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("extracts productName from English availability message", () => {
    expect(extractEntitiesFromText("Do you have Laptop X Pro in stock")).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("extracts productName from Spanish price message", () => {
    expect(extractEntitiesFromText("Quiero saber el precio de Laptop X Pro")).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("extracts productName from Spanish availability message", () => {
    expect(extractEntitiesFromText("Tienen disponible Laptop X Pro")).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("extracts productName from Spanish product-information message", () => {
    expect(
      extractEntitiesFromText("Necesito información del producto Laptop X Pro")
    ).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("falls back to raw product name for short product-only message", () => {
    expect(extractEntitiesFromText("Laptop X Pro")).toContainEqual({
      entityId: "productName",
      value: "Laptop X Pro",
      confidence: "derived",
    });
  });

  it("does not falsely extract productName from order-only message", () => {
    const entities = extractEntitiesFromText("I want to know my order status");
    expect(entities.find((item) => item.entityId === "productName")).toBeUndefined();
  });
});
