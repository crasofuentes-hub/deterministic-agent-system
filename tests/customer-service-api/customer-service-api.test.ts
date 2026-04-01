import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-api", () => {
  it("returns missing-entity response for incomplete coverage consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
    });

    expect(result).toEqual({
      sessionId: "S-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the coverage option name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns resolved response for request-status consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-12345?",
    });

    expect(result).toEqual({
      sessionId: "S-002",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "Order ORDER-12345 is currently under-review. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time.",
      stage: "resolve-order-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns canonical request-not-found response for request-status consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-00000?",
    });

    expect(result).toEqual({
      sessionId: "S-003",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "I could not find an order with the provided order ID. Please verify the order ID and try again.",
      stage: "resolve-order-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns canonical invalid-request-id response for request-status consultation", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-??",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.status).toBe("missing-entity");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "The provided order ID format is invalid. Please provide a valid order ID and try again."
    );
  });

  it("returns structured handoff metadata for broker specialist handoff requests", () => {
    const result = runCustomerServiceApi({
      sessionId: "S-005",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want to speak to a human agent",
    });

    expect(result).toEqual({
      sessionId: "S-005",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "request-human-handoff",
      responseId: "handoff-requested",
      responseText: "Your conversation will be transferred to a licensed broker specialist.",
      stage: "handoff-requested",
      status: "handoff",
      humanInterventionRequired: true,
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "licensed-broker",
    });
  });

  it("returns resolved payment status output for payment audit context", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-001",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "What is the status of payment PMT-1001?",
    });

    expect(result).toEqual({
      sessionId: "PA-001",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "consult-payment-status",
      responseId: "consult-payment-status-resolved",
      responseText: "Payment PMT-1001 is currently posted. Audit status: reconciled. No discrepancy has been detected at this time.",
      stage: "resolve-payment-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns resolved payment history output for payment audit context", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-002",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "Show me the payment history for policy POL-900",
    });

    expect(result).toEqual({
      sessionId: "PA-002",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "consult-payment-history",
      responseId: "consult-payment-history-resolved",
      responseText: "Payment history scope: Policy POL-900 | Records: 1 | Latest payment: PMT-1001 | Latest audit status: reconciled.",
      stage: "resolve-payment-history",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns structured handoff metadata for billing specialist handoff in payment audit context", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-003",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I need a billing specialist",
    });

    expect(result).toEqual({
      sessionId: "PA-003",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "request-human-handoff",
      responseId: "handoff-requested",
      responseText: "Your conversation will be transferred to a billing or licensed insurance specialist.",
      stage: "handoff-requested",
      status: "handoff",
      humanInterventionRequired: true,
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "billing-specialist",
    });
  });
});