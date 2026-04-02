import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";
import { runWhatsAppCustomerServiceBridge } from "../../src/channels/whatsapp/agent-bridge";
import { runCustomerServiceAgent } from "../../src/customer-service-agent/customer-service-agent";
import { createInitialSessionState } from "../../src/session-state/session-state";
import type { CustomerMessage } from "../../src/customer-messages/types";

function createWhatsAppMessage(text: string, channelMessageId: string): CustomerMessage {
  return {
    channel: "whatsapp",
    channelMessageId,
    customerId: "5215512345678",
    text,
    receivedAtIso: "2026-03-24T00:00:00.000Z",
    traceId: "whatsapp:" + channelMessageId,
    metadata: {
      whatsappPhoneNumberId: "phone-number-id-001",
      whatsappDisplayPhoneNumber: "15551234567",
      whatsappWaId: "5215512345678",
      profileName: "Oscar Cliente",
    },
  };
}

describe("customer-service semantic invariants", () => {
  it("keeps human handoff output canonical in API", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want to speak to a human agent",
    });

    expect(result.resolvedIntentId).toBe("request-human-handoff");
    expect(result.responseId).toBe("handoff-requested");
    expect(result.stage).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
    expect(result.humanInterventionRequired).toBe(true);
    expect(result.handoffReasonCode).toBe("explicit-human-request");
    expect(result.handoffQueue).toBe("licensed-broker");
    expect(result.responseText).toBe(
      "Your conversation will be transferred to a licensed broker specialist."
    );
  });

  it("keeps human handoff output canonical in WhatsApp bridge", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "INV-WA-001",
        businessContextId: "customer-service-core-v2",
      }),
      message: createWhatsAppMessage("I need a human agent", "wamid.inv.001"),
    });

    expect(result.output.resolvedIntentId).toBe("request-human-handoff");
    expect(result.output.responseId).toBe("handoff-requested");
    expect(result.output.stage).toBe("handoff-requested");
    expect(result.output.status).toBe("handoff");
    expect(result.output.humanInterventionRequired).toBe(true);
    expect(result.output.handoffReasonCode).toBe("explicit-human-request");
    expect(result.output.handoffQueue).toBe("licensed-broker");
  });

  it("keeps missing-request-id output canonical", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want to know my order status",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-missing-order-id");
    expect(result.stage).toBe("collect-order-id");
    expect(result.status).toBe("missing-entity");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Please provide your request ID so I can review the status."
    );
  });

  it("keeps invalid-request-id output canonical without changing status family", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-??",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-missing-order-id");
    expect(result.stage).toBe("collect-order-id");
    expect(result.status).toBe("missing-entity");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "The provided order ID format is invalid. Please provide a valid order ID and try again."
    );
  });

  it("keeps request-not-found output canonical in resolved family", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-00000?",
    });

    expect(result.resolvedIntentId).toBe("consult-order-status");
    expect(result.responseId).toBe("consult-order-status-resolved");
    expect(result.stage).toBe("resolve-order-status");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "I could not find an order with the provided order ID. Please verify the order ID and try again."
    );
  });

  it("keeps consult-policy summary canonical", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-005",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is your return policy?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Policy: Policy Document Delivery Policy | Summary: Policy documents are generally issued within 30 calendar days of binding, subject to underwriting completion and document review."
    );
  });

  it("keeps consult-policy follow-up canonical for refund timing", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-006",
      businessContextId: "customer-service-core-v2",
      userMessageText: "How long do refunds take?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "Policy: Premium Adjustment Policy | Refund Timing: 5 to 10 business days after the return is processed."
    );
  });

  it("does not allow consult-policy to drift into handoff metadata", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-007",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Can I cancel an order after shipment?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Policy: Cancellation Policy | Cancellation Eligibility: Orders may be cancelled before shipment only. Orders that have already shipped cannot be cancelled and must follow the return policy."
    );
  });

  it("keeps consult-product not-found canonical without changing intent family", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-008",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I need information about Excess Umbrella Select",
    });

    expect(result.resolvedIntentId).toBe("consult-product");
    expect(result.responseId).toBe("consult-product-resolved");
    expect(result.stage).toBe("resolve-product");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "I could not find a product with the provided product name. Please verify the product name and try again."
    );
  });

  it("keeps consult-price not-found canonical without changing intent family", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-009",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the price of Excess Umbrella Select?",
    });

    expect(result.resolvedIntentId).toBe("consult-price");
    expect(result.responseId).toBe("consult-price-resolved");
    expect(result.stage).toBe("resolve-price");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "I could not find a product with the provided product name. Please verify the product name and try again."
    );
  });

  it("keeps consult-availability not-found canonical without changing intent family", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-010",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Is Excess Umbrella Select available?",
    });

    expect(result.resolvedIntentId).toBe("consult-availability");
    expect(result.responseId).toBe("consult-availability-resolved");
    expect(result.stage).toBe("resolve-availability");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "I could not find a product with the provided product name. Please verify the product name and try again."
    );
  });

  it("keeps consult-policy not-found canonical in resolved family when session carries an unknown policy topic", () => {
    let session = createInitialSessionState({
      sessionId: "INV-011",
      businessContextId: "customer-service-core-v2",
    });

    session = {
      ...session,
      collectedEntities: [
        {
          entityId: "policyTopic",
          value: "cancellation-policy-legacy",
          confidence: "confirmed",
        },
      ],
    };

    const result = runCustomerServiceAgent({
      session,
      userMessageText: "policy",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.responseText).toBe(
      "I could not find policy information for the provided policy topic. Please verify the policy topic and try again."
    );
  });
  it("keeps consult-policy guidance canonical for document delivery status", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-012",
      businessContextId: "customer-service-core-v2",
      userMessageText: "When will my policy documents be issued?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "Policy: Policy Document Delivery Policy | Document Delivery Status: Document delivery status checks are supported. Document delivery status can be reviewed by a broker specialist when binding has been completed and all required underwriting documents have been received."
    );
  });

  it("keeps consult-policy guidance canonical for premium adjustment requests", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-013",
      businessContextId: "customer-service-core-v2",
      userMessageText: "How do I request a premium adjustment?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "Policy: Premium Adjustment Policy | Premium Adjustment Guidance: Premium adjustment requests are supported. Premium adjustment requests may require broker review, underwriting confirmation, and supporting policy change details before the adjustment is finalized."
    );
  });

  it("keeps consult-policy guidance canonical for endorsement requests", () => {
    const result = runCustomerServiceApi({
      sessionId: "INV-014",
      businessContextId: "customer-service-core-v2",
      userMessageText: "How do I request a policy change?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy");
    expect(result.responseId).toBe("consult-policy-resolved");
    expect(result.stage).toBe("resolve-policy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.responseText).toBe(
      "Policy: Cancellation Policy | Endorsement Guidance: Policy change and endorsement requests are supported. Policy change and endorsement requests may be submitted through a broker specialist and may require carrier approval before the updated documents are issued."
    );
  });

  it("keeps payment-status output canonical in payment audit API", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-001",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "What is the status of payment PMT-1001?",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-status");
    expect(result.responseId).toBe("consult-payment-status-resolved");
    expect(result.stage).toBe("resolve-payment-status");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Payment PMT-1001 is currently posted. Audit status: reconciled. No discrepancy has been detected at this time."
    );
  });

  it("keeps payment-history output canonical in payment audit API", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-002",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "Show me the payment history for policy POL-900",
    });

    expect(result.resolvedIntentId).toBe("consult-payment-history");
    expect(result.responseId).toBe("consult-payment-history-resolved");
    expect(result.stage).toBe("resolve-payment-history");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Payment history scope: Policy POL-900 | Records: 2 | Latest payment: PMT-1004 | Latest audit status: reconciled | Payment statuses: posted:2."
    );
  });

  it("keeps payment-discrepancy output canonical without changing intent family", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-003",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I was charged twice and need a billing discrepancy review",
    });

    expect(result.resolvedIntentId).toBe("explain-payment-discrepancy");
    expect(result.responseId).toBe("explain-payment-discrepancy-resolved");
    expect(result.stage).toBe("resolve-payment-discrepancy");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Payment discrepancy review: PMT-1002 | Discrepancy Type: duplicate-charge | Audit Result: under-review | Billing state: review-required."
    );
  });

  it("keeps missing-policy-id output canonical in payment audit API", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-004",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "Is my policy active?",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-status");
    expect(result.responseId).toBe("consult-policy-status-missing-policy-id");
    expect(result.stage).toBe("collect-policy-id");
    expect(result.status).toBe("missing-entity");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Please provide the policy ID so I can review the policy status."
    );
  });

  it("keeps policy-servicing output canonical in payment audit API", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-005",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I need help with document delivery for my policy",
    });

    expect(result.resolvedIntentId).toBe("consult-policy-servicing");
    expect(result.responseId).toBe("consult-policy-servicing-resolved");
    expect(result.stage).toBe("resolve-policy-servicing");
    expect(result.status).toBe("resolved");
    expect(result.humanInterventionRequired).toBe(false);
    expect(result.handoffReasonCode).toBeUndefined();
    expect(result.handoffQueue).toBeUndefined();
    expect(result.responseText).toBe(
      "Policy servicing topic: document-delivery | Guidance: the servicing request can proceed through the billing review workflow."
    );
  });

  it("keeps billing handoff output canonical in payment audit API", () => {
    const result = runCustomerServiceApi({
      sessionId: "PA-INV-006",
      businessContextId: "customer-service-payment-audit-v1",
      userMessageText: "I need a billing specialist",
    });

    expect(result.resolvedIntentId).toBe("request-human-handoff");
    expect(result.responseId).toBe("handoff-requested");
    expect(result.stage).toBe("handoff-requested");
    expect(result.status).toBe("handoff");
    expect(result.humanInterventionRequired).toBe(true);
    expect(result.handoffReasonCode).toBe("explicit-human-request");
    expect(result.handoffQueue).toBe("billing-specialist");
    expect(result.responseText).toBe(
      "Your conversation will be transferred to a billing or licensed insurance specialist."
    );
  });

  it("keeps billing handoff output canonical in payment audit WhatsApp bridge", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "PA-INV-WA-001",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      message: createWhatsAppMessage("I need a billing specialist", "wamid.pa.inv.001"),
    });

    expect(result.output.resolvedIntentId).toBe("request-human-handoff");
    expect(result.output.responseId).toBe("handoff-requested");
    expect(result.output.stage).toBe("handoff-requested");
    expect(result.output.status).toBe("handoff");
    expect(result.output.humanInterventionRequired).toBe(true);
    expect(result.output.handoffReasonCode).toBe("explicit-human-request");
    expect(result.output.handoffQueue).toBe("billing-specialist");
  });
});