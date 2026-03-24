import { describe, expect, it } from "vitest";
import { handleWhatsAppWebhook } from "../../src/http/handlers/whatsapp-webhook";
import { createInitialSessionState } from "../../src/session-state/session-state";

function createMockResponse() {
  let body = "";
  const headers: Record<string, string> = {};

  return {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      body = typeof chunk === "string" ? chunk : "";
    },
    getBody() {
      return body;
    },
  };
}

describe("whatsapp webhook handler", () => {
  it("returns challenge for valid verification request", async () => {
    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "GET",
        url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=abc123",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
      }
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(res.getBody()).toBe("abc123");
  });

  it("rejects invalid verification token", async () => {
    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "GET",
        url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=abc123",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
      }
    );

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "invalid verify token",
    });
  });

  it("executes the customer-service bridge for inbound POST messages", async () => {
    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        loadSession: (customerId) =>
          createInitialSessionState({
            sessionId: "whatsapp-session:" + customerId,
            businessContextId: "customer-service-core-v2",
          }),
        bodyText: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "entry-001",
              changes: [
                {
                  field: "messages",
                  value: {
                    metadata: {
                      display_phone_number: "15551234567",
                      phone_number_id: "phone-number-id-001",
                    },
                    contacts: [
                      {
                        profile: {
                          name: "Oscar Cliente",
                        },
                        wa_id: "5215512345678",
                      },
                    ],
                    messages: [
                      {
                        from: "5215512345678",
                        id: "wamid.HBgLN...",
                        timestamp: "1774310400",
                        type: "text",
                        text: {
                          body: "What is the price of Laptop X Pro?",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.getBody());

    expect(json.ok).toBe(true);
    expect(json.messagesReceived).toBe(1);
    expect(json.results).toHaveLength(1);

    expect(json.results[0].message).toEqual({
      channel: "whatsapp",
      channelMessageId: "wamid.HBgLN...",
      customerId: "5215512345678",
      text: "What is the price of Laptop X Pro?",
      receivedAtIso: "2026-03-24T00:00:00.000Z",
      traceId: "whatsapp:wamid.HBgLN...",
      metadata: {
        whatsappPhoneNumberId: "phone-number-id-001",
        whatsappDisplayPhoneNumber: "15551234567",
        whatsappWaId: "5215512345678",
        profileName: "Oscar Cliente",
      },
    });

    expect(json.results[0].agent).toEqual({
      channel: "whatsapp",
      customerId: "5215512345678",
      inboundMessageId: "wamid.HBgLN...",
      outboundText: "Product: Laptop X Pro | Price: 1499.99 USD",
      responseId: "consult-price-resolved",
      resolvedIntentId: "consult-price",
      stage: "resolve-price",
      status: "resolved",
    });

    expect(json.results[0].session).toEqual(
      expect.objectContaining({
        sessionId: "whatsapp-session:5215512345678",
        businessContextId: "customer-service-core-v2",
        currentIntentId: "consult-price",
        conversationStatus: "active",
        missingEntityIds: [],
      })
    );

    expect(json.results[0].session.collectedEntities).toEqual([
      {
        entityId: "productName",
        value: "Laptop X Pro",
        confidence: "derived",
      },
    ]);
  });

  it("rejects invalid JSON POST bodies", async () => {
    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        bodyText: "{invalid-json",
      }
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "body must be valid JSON",
    });
  });
});
