import { describe, expect, it } from "vitest";
import { resolveIntentFromText } from "../../src/intent-resolver/intent-resolver";

describe("intent-resolver", () => {
  it("resolves broker handoff deterministically", () => {
    expect(resolveIntentFromText("I want to speak with a broker")).toEqual({
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

  it("resolves application status deterministically", () => {
    expect(resolveIntentFromText("What is the status of my application ORDER-55555?")).toEqual({
      intentId: "consult-order-status",
      confidence: "rule",
    });
  });

  it("resolves policy deterministically from policy document phrasing", () => {
    expect(resolveIntentFromText("When will my policy documents be issued?")).toEqual({
      intentId: "consult-policy",
      confidence: "rule",
    });
  });

  it("prioritizes policy intent for cancellation-before-binding questions", () => {
    expect(resolveIntentFromText("Can I cancel before binding?")).toEqual({
      intentId: "consult-policy",
      confidence: "rule",
    });
  });

  it("resolves availability from coverage eligibility phrasing", () => {
    expect(resolveIntentFromText("Is General Liability Core eligible?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves availability from coverage options phrasing", () => {
    expect(resolveIntentFromText("What coverage options do you offer for commercial property?")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves price deterministically from premium phrasing", () => {
    expect(resolveIntentFromText("What is the estimated premium for General Liability Core?")).toEqual({
      intentId: "consult-price",
      confidence: "rule",
    });
  });

  it("resolves coverage information deterministically", () => {
    expect(resolveIntentFromText("Can you tell me about Personal Auto Standard?")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });

  it("falls back to consult-product deterministically", () => {
    expect(resolveIntentFromText("Personal Auto Standard")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });
});