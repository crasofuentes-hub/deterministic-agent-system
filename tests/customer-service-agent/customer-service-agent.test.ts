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

  it("resolves policy servicing from billing topic and policy id in one message", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-020",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "I need help with refund timing for policy POL-901",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-servicing");
    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Policy servicing topic: refund-timing | Guidance: the servicing request can proceed through the manual-review-recommended."
    );
  });

  it("resolves document delivery servicing from billing topic and policy id in one message", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-021",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      userMessageText: "I need help with document delivery for policy POL-900",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-servicing");
    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Policy servicing topic: document-delivery | Guidance: the servicing request can proceed through the billing-review-workflow."
    );
  });

  it("resolves quote intake when product name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-022",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need a quote for Personal Auto Standard",
    });

    expect(result.resolvedIntentId).toBe("request-quote");
    expect(result.responseId).toBe("request-quote-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review."
    );
  });

  it("keeps quote intake canonical when product name is missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-023",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Can I get a quote?",
    });

    expect(result.resolvedIntentId).toBe("request-quote");
    expect(result.responseId).toBe("request-quote-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Quote intake started. Please provide the coverage option name so a quote can be prepared."
    );
  });

  it("resolves renewal status when product name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-024",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need a renewal update for Personal Auto Standard",
    });

    expect(result.resolvedIntentId).toBe("consult-renewal-status");
    expect(result.responseId).toBe("consult-renewal-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Renewal status for Personal Auto Standard: the policy is currently in renewal review. Updated premium and eligibility guidance can now be prepared."
    );
  });

  it("keeps renewal status canonical when context is missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-025",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What is the renewal status for my policy?",
    });

    expect(result.resolvedIntentId).toBe("consult-renewal-status");
    expect(result.responseId).toBe("consult-renewal-status-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Renewal status check started. Please provide the coverage option name or renewal request ID so I can continue."
    );
  });

  it("resolves coverage consultation when product name is present", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-026",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "Does Personal Auto Standard cover roadside assistance?",
    });

    expect(result.resolvedIntentId).toBe("consult-coverage");
    expect(result.responseId).toBe("consult-coverage-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Coverage summary for Personal Auto Standard: standard protections are included, while final covered scenarios remain subject to underwriting and policy terms."
    );
  });

  it("keeps coverage consultation canonical when product name is missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-027",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "What does this cover?",
    });

    expect(result.resolvedIntentId).toBe("consult-coverage");
    expect(result.responseId).toBe("consult-coverage-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Coverage review started. Please provide the coverage option name so I can explain what is included."
    );
  });

  it("requests state when quote product is present but state is missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-028",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need a quote for Personal Auto Standard",
    });

    expect(result.resolvedIntentId).toBe("request-quote");
    expect(result.responseId).toBe("request-quote-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review."
    );
  });

  it("requests vehicle use when product and state are present but vehicle use is missing", () => {
    const result = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-029",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need a quote for Personal Auto Standard in CA, call me",
    });

    expect(result.resolvedIntentId).toBe("request-quote");
    expect(result.responseId).toBe("request-quote-resolved");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "Quote intake started for Personal Auto Standard in CA. Please describe the primary vehicle use as personal, commute, business, or rideshare so a broker can continue the quote review."
    );
  });

  it("completes quote intake across turns using remembered product context", () => {
    const first = runCustomerServiceAgent({
      session: createInitialSessionState({
        sessionId: "S-030",
        businessContextId: "customer-service-core-v2",
      }),
      userMessageText: "I need a quote for Personal Auto Standard",
    });

    const second = runCustomerServiceAgent({
      session: first.session,
      userMessageText: "California, call me",
    });

    const third = runCustomerServiceAgent({
      session: second.session,
      userMessageText: "commuting",
    });

    expect(first.resolvedIntentId).toBe("request-quote");
    expect(first.status).toBe("resolved");
    expect(first.responseText).toBe(
      "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review."
    );

    expect(second.resolvedIntentId).toBe("request-quote");
    expect(second.responseId).toBe("request-quote-resolved");
    expect(second.status).toBe("resolved");
    expect(second.responseText).toBe(
      "Quote intake started for Personal Auto Standard in CA. Please describe the primary vehicle use as personal, commute, business, or rideshare so a broker can continue the quote review."
    );

    expect(third.resolvedIntentId).toBe("request-quote");
    expect(third.responseId).toBe("request-quote-resolved");
    expect(third.status).toBe("resolved");
    expect(third.responseText).toBe(
      "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Preferred contact: call."
    );
  });
});