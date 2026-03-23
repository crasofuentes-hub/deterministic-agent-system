import { describe, expect, it } from "vitest";
import { resolveIntentFromText } from "../../src/intent-resolver/intent-resolver";

describe("intent-resolver", () => {
  it("resolves human handoff deterministically", () => {
    expect(resolveIntentFromText("I want to speak with a human agent")).toEqual({
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
    expect(resolveIntentFromText("What is the status of my order?")).toEqual({
      intentId: "consult-order-status",
      confidence: "rule",
    });
  });

  it("resolves availability deterministically", () => {
    expect(resolveIntentFromText("Is Laptop X Pro in stock?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves price deterministically", () => {
    expect(resolveIntentFromText("What is the price of Laptop X Pro?")).toEqual({
      intentId: "consult-price",
      confidence: "rule",
    });
  });

  it("falls back to consult-product deterministically", () => {
    expect(resolveIntentFromText("I need details about Laptop X Pro")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });
});