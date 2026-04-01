import { describe, expect, it } from "vitest";
import { runWhatsAppCustomerServiceBridge } from "../../src/channels/whatsapp/agent-bridge";
import { createInitialSessionState } from "../../src/session-state/session-state";
import type { CustomerMessage } from "../../src/customer-messages/types";

function createMessage(text: string, channelMessageId: string): CustomerMessage {
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

describe("whatsapp agent bridge", () => {
  it("returns a resolved outbound response for a complete price query", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-001",
        businessContextId: "customer-service-core-v2",
      }),
      message: createMessage("What is the price of Personal Auto Standard?", "wamid.test.001"),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.001",
      outboundText: "Product: Personal Auto Standard | Price: 128.50 USD",
      responseId: "consult-price-resolved",
      resolvedIntentId: "consult-price",
      stage: "resolve-price",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns a missing-entity outbound response when order id is absent", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-002",
        businessContextId: "customer-service-core-v2",
      }),
      message: createMessage("I want to know my order status", "wamid.test.002"),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.002",
      outboundText: "Please provide your request ID so I can review the status.",
      responseId: "consult-order-status-missing-order-id",
      resolvedIntentId: "consult-order-status",
      stage: "collect-order-id",
      status: "missing-entity",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("resolves a second turn using the existing waiting-user session", () => {
    const first = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-003",
        businessContextId: "customer-service-core-v2",
      }),
      message: createMessage("I want information about a product", "wamid.test.003"),
    });

    const second = runWhatsAppCustomerServiceBridge({
      session: first.session,
      message: createMessage("Personal Auto Standard", "wamid.test.004"),
    });

    expect(first.output.status).toBe("missing-entity");
    expect(second.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.004",
      outboundText:
        "Product: Personal Auto Standard | SKU: AUTO-PERS-STD | Price: 128.50 USD | Availability: eligible | Summary: Personal Auto Standard is an entry-level personal auto coverage option for everyday drivers seeking basic liability and property damage protection.",
      responseId: "consult-product-resolved",
      resolvedIntentId: "consult-product",
      stage: "resolve-product",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns structured handoff metadata in whatsapp output", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-004",
        businessContextId: "customer-service-core-v2",
      }),
      message: createMessage("I want to speak to a human agent", "wamid.test.005"),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.005",
      outboundText: "Your conversation will be transferred to a licensed broker specialist.",
      responseId: "handoff-requested",
      resolvedIntentId: "request-human-handoff",
      stage: "handoff-requested",
      status: "handoff",
      humanInterventionRequired: true,
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "licensed-broker",
    });
  });

  it("returns resolved payment status output in payment audit context", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-005",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      message: createMessage("What is the status of payment PMT-1001?", "wamid.test.006"),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.006",
      outboundText: "Payment PMT-1001 is currently posted. Audit status: reconciled. No discrepancy has been detected at this time.",
      responseId: "consult-payment-status-resolved",
      resolvedIntentId: "consult-payment-status",
      stage: "resolve-payment-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns structured billing handoff metadata in payment audit context", () => {
    const result = runWhatsAppCustomerServiceBridge({
      session: createInitialSessionState({
        sessionId: "WA-006",
        businessContextId: "customer-service-payment-audit-v1",
      }),
      message: createMessage("I need a billing specialist", "wamid.test.007"),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.007",
      outboundText: "Your conversation will be transferred to a billing or licensed insurance specialist.",
      responseId: "handoff-requested",
      resolvedIntentId: "request-human-handoff",
      stage: "handoff-requested",
      status: "handoff",
      humanInterventionRequired: true,
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "billing-specialist",
    });
  });
});