import { describe, expect, it } from "vitest";
import { runCustomerServiceAgent } from "../../src/customer-service-agent/customer-service-agent";
import { createInitialSessionState } from "../../src/session-state/session-state";

describe("customer-service-agent", () => {
  it("asks for coverage option name when missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I want information about a product",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-missing-product-name");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the coverage option name so I can help you."
    );
  });

  it("returns real coverage option knowledge and product data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-001",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need Personal Auto Standard",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Product: Personal Auto Standard | SKU: AUTO-PERS-STD | Price: 128.50 USD | Availability: eligible | Summary: Personal Auto Standard is an entry-level personal auto coverage option for everyday drivers seeking basic liability and property damage protection."
    );
  });

  it("returns real estimated premium data when coverage option name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-002",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the price of Personal Auto Standard?",
    });

    expect(result.resolvedIntentId).toBe("consult-price");
    expect(result.responseText).toBe("Product: Personal Auto Standard | Price: 128.50 USD");
  });

  it("returns rich broker eligibility data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-003",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Is General Liability Core eligible?",
    });

    expect(result.resolvedIntentId).toBe("consult-availability");
    expect(result.responseText).toBe(
      "Product: General Liability Core | Availability: broker-review | Eligibility: broker-review-required | Broker Review Required: true | Underwriting Review Required: false | Additional Documents Required: false | Notes: Broker review is required before this coverage option can be confirmed."
    );
  });

  it("returns real request status data", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-004",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-12345?",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseText).toBe(
      "Order ORDER-12345 is currently under-review. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time."
    );
  });

  it("returns canonical request-not-found response", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-005",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-00000?",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "I could not find an order with the provided order ID. Please verify the order ID and try again."
    );
  });

  it("returns canonical invalid-request-id response", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-006",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the status of order ORDER-??",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "The provided order ID format is invalid. Please provide a valid order ID and try again."
    );
  });

  it("resolves payment status in payment audit context", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-007",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "What is the status of payment PMT-1001?",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-status");
    expect(result.responseId).toBe("consult-payment-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment PMT-1001 is currently posted. Audit status: reconciled. No discrepancy has been detected at this time."
    );
  });

  it("resolves payment history in payment audit context", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-008",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "Show me the payment history for policy POL-900",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-history");
    expect(result.responseId).toBe("consult-payment-history-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment history scope: Policy POL-900 | Records: 2 | Latest payment: PMT-1004 | Latest audit status: reconciled | Payment statuses: posted:2."
    );
  });

  it("resolves payment discrepancy in payment audit context", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-009",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "I was charged twice and need a billing discrepancy review",
    });

    expect(result.resolvedIntentId).toBe("explain-payment-discrepancy");
    expect(result.responseId).toBe("explain-payment-discrepancy-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment discrepancy review: PMT-1007 | Discrepancy Type: duplicate-charge | Audit Result: exception | Billing state: delinquent."
    );
  });

  it("asks for missing policy id in payment audit context", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-010",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "Is my policy active?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-status");
    expect(result.responseId).toBe("consult-policy-status-missing-policy-id");
    expect(result.status).toBe("missing-entity");
    expect(result.responseText).toBe(
      "Please provide the policy ID so I can review the policy status."
    );
  });

  it("resolves policy servicing in payment audit context", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-011",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "I need help with document delivery for my policy",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-servicing");
    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Policy servicing topic: document-delivery | Guidance: the servicing request can proceed through the billing review workflow."
    );
  });

  it("resolves payment history by customer id across multiple policies", () => {
    const session = {
      ...createInitialSessionState({
        sessionId: "S-016",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      collectedEntities: [
        {
          entityId: "customerId",
          value: "CUS-101",
          confidence: "confirmed",
        },
      ],
    };

    const result = runCustomerServiceAgent({
      session,
      userMessageText: "Show me the payment history",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-history");
    expect(result.responseId).toBe("consult-payment-history-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment history scope: Customer CUS-101 | Records: 3 | Latest payment: PMT-1007 | Latest audit status: exception | Payment statuses: failed:1,pending:1,posted:1."
    );
  });

  it("selects the latest duplicate-charge discrepancy deterministically", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-017",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "I need help with a duplicate charge",
    });

    expect(result.resolvedIntentId).toBe("explain-payment-discrepancy");
    expect(result.responseId).toBe("explain-payment-discrepancy-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment discrepancy review: PMT-1007 | Discrepancy Type: duplicate-charge | Audit Result: exception | Billing state: delinquent."
    );
  });

  it("returns policy servicing not-found output when policy id has no records", () => {
    const session = {
      ...createInitialSessionState({
        sessionId: "S-018",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      collectedEntities: [
        {
          entityId: "policyId",
          value: "POL-999",
          confidence: "confirmed",
        },
      ],
    };

    const result = runCustomerServiceAgent({
      session,
      userMessageText: "I need help with refund timing",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-servicing");
    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "I could not find policy servicing information for the provided policy ID. Please verify the policy ID and try again."
    );
  });

  it("resolves payment history directly from customer id in message", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-019",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "Show me the payment history for customer CUS-101",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-history");
    expect(result.responseId).toBe("consult-payment-history-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Payment history scope: Customer CUS-101 | Records: 3 | Latest payment: PMT-1007 | Latest audit status: exception | Payment statuses: failed:1,pending:1,posted:1."
    );
  });
});
