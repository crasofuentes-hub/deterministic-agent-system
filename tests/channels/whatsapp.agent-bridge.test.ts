import { describe, expect, it } from "vitest";
import { runWhatsAppCustomerServiceBridge } from "../../src/channels/whatsapp/agent-bridge";
import { createInitialSessionState } from "../../src/session-state/session-state";
import type { CustomerMessage } from "../../src/customer-messages/types";

function createMessage(overrides?: Partial<CustomerMessage>): CustomerMessage {
  return {
    channel: "whatsapp",
    channelMessageId: "wamid.test.001",
    customerId: "5215512345678",
    text: "What is the price of Laptop X Pro?",
    receivedAtIso: "2026-03-24T00:00:00.000Z",
    traceId: "whatsapp:wamid.test.001",
    metadata: {
      whatsappPhoneNumberId: "phone-number-id-001",
      whatsappDisplayPhoneNumber: "15551234567",
      whatsappWaId: "5215512345678",
      profileName: "Oscar Cliente",
    },
    ...overrides,
  };
}

describe("whatsapp agent bridge", () => {
  it("returns a resolved outbound response for a complete price query", () => {
    const session = createInitialSessionState({
      sessionId: "WA-SESSION-001",
      businessContextId: "customer-service-core-v2",
    });

    const result = runWhatsAppCustomerServiceBridge({
      session,
      message: createMessage(),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.001",
      outboundText: "Product: Laptop X Pro | Price: 1499.99 USD",
      responseId: "consult-price-resolved",
      resolvedIntentId: "consult-price",
      stage: "resolve-price",
      status: "resolved",
    });

    expect(result.session.conversationStatus).toBe("active");
    expect(result.agent.responseText).toBe("Product: Laptop X Pro | Price: 1499.99 USD");
  });

  it("returns a missing-entity outbound response when order id is absent", () => {
    const session = createInitialSessionState({
      sessionId: "WA-SESSION-002",
      businessContextId: "customer-service-core-v2",
    });

    const result = runWhatsAppCustomerServiceBridge({
      session,
      message: createMessage({
        channelMessageId: "wamid.test.002",
        text: "I want to know my order status",
      }),
    });

    expect(result.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.002",
      outboundText: "Please provide your order ID so I can review the order status.",
      responseId: "consult-order-status-missing-order-id",
      resolvedIntentId: "consult-order-status",
      stage: "collect-order-id",
      status: "missing-entity",
    });

    expect(result.session.conversationStatus).toBe("waiting-user");
    expect(result.session.missingEntityIds).toEqual(["orderId"]);
  });

  it("resolves a second turn using the existing waiting-user session", () => {
    const initialSession = createInitialSessionState({
      sessionId: "WA-SESSION-003",
      businessContextId: "customer-service-core-v2",
    });

    const first = runWhatsAppCustomerServiceBridge({
      session: initialSession,
      message: createMessage({
        channelMessageId: "wamid.test.003",
        text: "I want information about a product",
      }),
    });

    const second = runWhatsAppCustomerServiceBridge({
      session: first.session,
      message: createMessage({
        channelMessageId: "wamid.test.004",
        text: "Laptop X Pro",
      }),
    });

    expect(first.output.status).toBe("missing-entity");
    expect(second.output).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.test.004",
      outboundText:
        "Product: Laptop X Pro | SKU: LAP-X-PRO | Price: 1499.99 USD | Availability: in-stock | Summary: Laptop X Pro is a high-performance laptop for productivity and advanced workloads.",
      responseId: "consult-product-resolved",
      resolvedIntentId: "consult-product",
      stage: "resolve-product",
      status: "resolved",
    });

    expect(second.session.conversationStatus).toBe("active");
    expect(second.session.missingEntityIds).toEqual([]);
  });
});
