import { describe, expect, it } from "vitest";
import { resolveIntentFromText } from "../../src/intent-resolver/intent-resolver";

describe("intent-resolver", () => {
  it("resolves human handoff deterministically", () => {
    expect(resolveIntentFromText("I want to talk to an agent")).toEqual({
      intentId: "request-human-handoff",
      confidence: "rule",
    });
  });

  it("resolves close conversation deterministically", () => {
    expect(resolveIntentFromText("Please close this conversation")).toEqual({
      intentId: "close-conversation",
      confidence: "rule",
    });
  });

  it("resolves order status deterministically", () => {
    expect(resolveIntentFromText("What is the status of my order ORDER-55555?")).toEqual({
      intentId: "consult-order-status",
      confidence: "rule",
    });
  });

  it("resolves policy deterministically", () => {
    expect(resolveIntentFromText("What is your return policy?")).toEqual({
      intentId: "consult-policy",
      confidence: "rule",
    });
  });

  it("prioritizes policy intent over order-status wording for cancellation questions", () => {
    expect(resolveIntentFromText("Can I cancel an order after shipment?")).toEqual({
      intentId: "consult-policy",
      confidence: "rule",
    });
  });

  it("resolves availability from natural inventory phrasing", () => {
    expect(resolveIntentFromText("Do you have Laptop X Pro?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves availability from explicit stock phrasing", () => {
    expect(resolveIntentFromText("Is Laptop X Pro in stock?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves price deterministically", () => {
    expect(resolveIntentFromText("What can you tell me about Laptop X Pro pricing?")).toEqual({
      intentId: "consult-price",
      confidence: "rule",
    });
  });

  it("resolves product information deterministically", () => {
    expect(resolveIntentFromText("Can you tell me about Laptop X Pro?")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });

  it("falls back to consult-product deterministically", () => {
    expect(resolveIntentFromText("Laptop X Pro")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });
});
