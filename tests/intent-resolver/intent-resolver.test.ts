import { describe, expect, it } from "vitest";
import {
  resolveIntentFromText,
  resolveIntentFromTextForContext,
} from "../../src/intent-resolver/intent-resolver";

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

  it("resolves payment status for payment audit context", () => {
    expect(
      resolveIntentFromTextForContext(
        "What is the status of payment PMT-1001?",
        "customer-service-payment-audit-v1"
      )
    ).toEqual({
      intentId: "consult-payment-status",
      confidence: "rule",
    });
  });

  it("resolves payment history for payment audit context", () => {
    expect(
      resolveIntentFromTextForContext(
        "Show me the payment history for policy POL-900",
        "customer-service-payment-audit-v1"
      )
    ).toEqual({
      intentId: "consult-payment-history",
      confidence: "rule",
    });
  });

  it("resolves payment discrepancy for payment audit context", () => {
    expect(
      resolveIntentFromTextForContext(
        "I was charged twice and need a billing discrepancy review",
        "customer-service-payment-audit-v1"
      )
    ).toEqual({
      intentId: "explain-payment-discrepancy",
      confidence: "rule",
    });
  });

  it("resolves policy status for payment audit context", () => {
    expect(
      resolveIntentFromTextForContext(
        "Is policy POL-900 active right now?",
        "customer-service-payment-audit-v1"
      )
    ).toEqual({
      intentId: "consult-policy-status",
      confidence: "rule",
    });
  });

  it("resolves policy servicing for payment audit context", () => {
    expect(
      resolveIntentFromTextForContext(
        "I need help with document delivery for my policy",
        "customer-service-payment-audit-v1"
      )
    ).toEqual({
      intentId: "consult-policy-servicing",
      confidence: "rule",
    });
  });

  it("resolves coverage questions in the insurance brokerage context", () => {
    expect(
      resolveIntentFromTextForContext(
        "Does Personal Auto Standard cover roadside assistance?",
        "customer-service-core-v2"
      )
    ).toEqual({
      intentId: "consult-coverage",
      confidence: "rule",
    });
  });
});
