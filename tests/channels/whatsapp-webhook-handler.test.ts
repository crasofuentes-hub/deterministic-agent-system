import { describe, expect, it, vi } from "vitest";
import { createMockWhatsAppSender } from "../../src/channels/whatsapp/client";
import { handleWhatsAppWebhook } from "../../src/http/handlers/whatsapp-webhook";
import { createInitialSessionState } from "../../src/session-state/session-state";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";

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

function buildInboundBody(messageId: string, userText: string): string {
  return JSON.stringify({
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
                  id: messageId,
                  timestamp: "1774310400",
                  type: "text",
                  text: {
                    body: userText,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
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

  it("builds outbound payload and skips delivery by default", async () => {
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
        bodyText: buildInboundBody("wamid.HBgLN...", "What is the price of Laptop X Pro?"),
      }
    );

    const json = JSON.parse(res.getBody());

    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.messagesReceived).toBe(1);
    expect(json.results[0].duplicate).toBe(false);
    expect(json.results[0].delivery).toEqual({
      mode: "skipped",
      result: null,
      deliveryStatus: "skipped",
      deliveryError: null,
    });
    expect(json.results[0].outbound).toEqual({
      messaging_product: "whatsapp",
      to: "5215512345678",
      type: "text",
      text: {
        body: "Product: Laptop X Pro | Price: 1499.99 USD",
      },
    });
  });

  it("sends with mock delivery mode when configured", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = createMockResponse();

    try {
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
          deliveryMode: "mock",
          loadSession: (customerId) =>
            createInitialSessionState({
              sessionId: "whatsapp-session:" + customerId,
              businessContextId: "customer-service-core-v2",
            }),
          bodyText: buildInboundBody("wamid.HBgLN...", "What is the price of Laptop X Pro?"),
        }
      );

      const json = JSON.parse(res.getBody());

      expect(res.statusCode).toBe(200);
      expect(json.results[0].delivery).toEqual({
        mode: "mock",
        result: {
          ok: true,
          mode: "mock",
          providerMessageId: "mocked-whatsapp-message-001",
          acceptedAtIso: "2026-03-24T00:00:00.000Z",
        },
        deliveryStatus: "sent",
        deliveryError: null,
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("surfaces failed delivery state when sender fails", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = createMockResponse();

    try {
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
          deliveryMode: "http",
          sender: {
            async send() {
              return {
                ok: false,
                mode: "http",
                error: "whatsapp http send timed out",
              };
            },
          },
          loadSession: (customerId) =>
            createInitialSessionState({
              sessionId: "whatsapp-session:" + customerId,
              businessContextId: "customer-service-core-v2",
            }),
          bodyText: buildInboundBody("wamid.fail.001", "What is the price of Laptop X Pro?"),
        }
      );

      const json = JSON.parse(res.getBody());

      expect(res.statusCode).toBe(200);
      expect(json.results[0].delivery).toEqual({
        mode: "http",
        result: {
          ok: false,
          mode: "http",
          error: "whatsapp http send timed out",
        },
        deliveryStatus: "failed",
        deliveryError: "whatsapp http send timed out",
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("uses store for session persistence and idempotent duplicate detection", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const firstRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      firstRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.store.001", "I want information about a product"),
      }
    );

    const firstJson = JSON.parse(firstRes.getBody());
    expect(firstRes.statusCode).toBe(200);
    expect(firstJson.results[0].duplicate).toBe(false);
    expect(firstJson.results[0].agent.status).toBe("missing-entity");

    const secondRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      secondRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.store.002", "Laptop X Pro"),
      }
    );

    const secondJson = JSON.parse(secondRes.getBody());
    expect(secondRes.statusCode).toBe(200);
    expect(secondJson.results[0].duplicate).toBe(false);
    expect(secondJson.results[0].agent.status).toBe("resolved");
    expect(secondJson.results[0].agent.outboundText).toContain("Laptop X Pro");

    const duplicateRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      duplicateRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.store.002", "Laptop X Pro"),
      }
    );

    const duplicateJson = JSON.parse(duplicateRes.getBody());
    expect(duplicateRes.statusCode).toBe(200);
    expect(duplicateJson.results[0]).toEqual(
      expect.objectContaining({
        duplicate: true,
        agent: null,
        outbound: null,
        delivery: {
          mode: "skipped",
          result: null,
          deliveryStatus: "skipped",
          deliveryError: null,
        },
      })
    );
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
