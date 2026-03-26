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

  it("resolves availability deterministically", () => {
    expect(resolveIntentFromText("Is Laptop X Pro available in stock?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves price deterministically", () => {
    expect(resolveIntentFromText("How much does Laptop X Pro cost?")).toEqual({
      intentId: "consult-price",
      confidence: "rule",
    });
  });

  it("falls back to consult-product deterministically", () => {
    expect(resolveIntentFromText("I need product information about Laptop X Pro")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });
});
