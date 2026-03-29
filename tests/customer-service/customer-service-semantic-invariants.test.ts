import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";
import { runWhatsAppCustomerServiceBridge } from "../../src/channels/whatsapp/agent-bridge";
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
    expect(result.handoffQueue).toBe("general");
    expect(result.responseText).toBe("Your conversation will be transferred to a human agent.");
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
    expect(result.output.handoffQueue).toBe("general");
  });

  it("keeps missing-order-id output canonical", () => {
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
      "Please provide your order ID so I can review the order status."
    );
  });

  it("keeps invalid-order-id output canonical without changing status family", () => {
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

  it("keeps order-not-found output canonical in resolved family", () => {
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
      "Policy: Return Policy | Summary: Returns are accepted within 30 calendar days of delivery for unused products in original condition."
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
      "Policy: Refund Policy | Refund Timing: 5 to 10 business days after the return is processed."
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
});