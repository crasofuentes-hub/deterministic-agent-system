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
      responseText: "Payment history scope: Policy POL-900 | Records: 2 | Latest payment: PMT-1004 | Latest audit status: reconciled | Payment statuses: posted:2.",
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

  it("returns latest duplicate-charge discrepancy output for payment audit context", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-006",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I need help with a duplicate charge",
    });

    expect(result).toEqual({
      sessionId: "PA-006",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "explain-payment-discrepancy",
      responseId: "explain-payment-discrepancy-resolved",
      responseText: "Payment discrepancy review: PMT-1007 | Discrepancy Type: duplicate-charge | Audit Result: exception | Billing state: delinquent.",
      stage: "resolve-payment-discrepancy",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns payment history directly from customer id in payment audit context", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-007",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "Show me the payment history for customer CUS-101",
    });

    expect(result).toEqual({
      sessionId: "PA-007",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "consult-payment-history",
      responseId: "consult-payment-history-resolved",
      responseText: "Payment history scope: Customer CUS-101 | Records: 3 | Latest payment: PMT-1007 | Latest audit status: exception | Payment statuses: failed:1,pending:1,posted:1.",
      stage: "resolve-payment-history",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns policy servicing from billing topic and policy id in one message", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-008",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I need help with refund timing for policy POL-901",
    });

    expect(result).toEqual({
      sessionId: "PA-008",
      businessContextId: "customer-service-payment-audit-v1",
      resolvedIntentId: "consult-policy-servicing",
      responseId: "consult-policy-servicing-resolved",
      responseText: "Policy servicing topic: refund-timing | Guidance: the servicing request can proceed through the manual-review-recommended.",
      stage: "resolve-policy-servicing",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns quote intake output for the insurance brokerage context", () => {
    const result = runCustomerServiceApi({
      sessionId: "CS-QUOTE-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I need a quote for Personal Auto Standard",
    });

    expect(result).toEqual({
      sessionId: "CS-QUOTE-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "request-quote",
      responseId: "request-quote-resolved",
      responseText: "Quote intake started for Personal Auto Standard. A broker can now continue with eligibility, underwriting review, and premium estimation.",
      stage: "resolve-quote-intake",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns renewal status output for the insurance brokerage context", () => {
    const result = runCustomerServiceApi({
      sessionId: "CS-RENEW-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I need a renewal update for Personal Auto Standard",
    });

    expect(result).toEqual({
      sessionId: "CS-RENEW-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-renewal-status",
      responseId: "consult-renewal-status-resolved",
      responseText: "Renewal status for Personal Auto Standard: the policy is currently in renewal review. Updated premium and eligibility guidance can now be prepared.",
      stage: "resolve-renewal-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });
});
