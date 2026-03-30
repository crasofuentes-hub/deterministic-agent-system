import { describe, expect, it } from "vitest";
import { extractEntitiesFromText } from "../../src/entity-extractor/entity-extractor";

describe("entity-extractor", () => {
  it("extracts orderId from application-status message", () => {
    expect(extractEntitiesFromText("What is the status of my application ORDER-55555?")).toContainEqual({
      entityId: "orderId",
      value: "ORDER-55555",
      confidence: "derived",
    });
  });

  it("extracts productName from premium message", () => {
    expect(extractEntitiesFromText("What is the estimated premium for Personal Auto Standard"))
      .toContainEqual({
        entityId: "productName",
        value: "Personal Auto Standard",
        confidence: "derived",
      });
  });

  it("extracts productName from eligibility message", () => {
    expect(extractEntitiesFromText("Is General Liability Core eligible?")).toContainEqual({
      entityId: "productName",
      value: "General Liability Core",
      confidence: "derived",
    });
  });

  it("extracts productName from coverage-information message", () => {
    expect(extractEntitiesFromText("Can you tell me about Commercial Property Plus")).toContainEqual(
      {
        entityId: "productName",
        value: "Commercial Property Plus",
        confidence: "derived",
      }
    );
  });

  it("falls back to raw product name for short coverage-only message", () => {
    expect(extractEntitiesFromText("Personal Auto Standard")).toContainEqual({
      entityId: "productName",
      value: "Personal Auto Standard",
      confidence: "derived",
    });
  });

  it("extracts policyTopic from policy documents phrasing", () => {
    expect(extractEntitiesFromText("When will my policy documents be issued?")).toContainEqual({
      entityId: "policyTopic",
      value: "return-policy",
      confidence: "derived",
    });
  });

  it("extracts policyAspect for document delivery timing questions", () => {
    expect(extractEntitiesFromText("When will my policy documents be issued?")).toContainEqual({
      entityId: "policyAspect",
      value: "return-window",
      confidence: "derived",
    });
  });

  it("extracts policyAspect for premium adjustment timing questions", () => {
    expect(extractEntitiesFromText("How long does a premium adjustment take?")).toContainEqual({
      entityId: "policyAspect",
      value: "refund-timing",
      confidence: "derived",
    });
  });

  it("extracts policyAspect for cancellation-before-binding questions", () => {
    expect(extractEntitiesFromText("Can I cancel before binding?")).toContainEqual({
      entityId: "policyAspect",
      value: "cancellation-eligibility",
      confidence: "derived",
    });
  });

  it("extracts cancellation policy topic from binding phrasing", () => {
    expect(extractEntitiesFromText("Can I cancel before binding?")).toContainEqual({
      entityId: "policyTopic",
      value: "cancellation-policy",
      confidence: "derived",
    });
  });

  it("extracts productName from coverage-options phrasing", () => {
    expect(
      extractEntitiesFromText("What coverage options do you offer for commercial property?")
    ).toContainEqual({
      entityId: "productName",
      value: "commercial property",
      confidence: "derived",
    });
  });

  it("does not falsely extract productName from application-status-only message", () => {
    const entities = extractEntitiesFromText("I want to know my application status");
    expect(entities.find((item) => item.entityId === "productName")).toBeUndefined();
  });
});