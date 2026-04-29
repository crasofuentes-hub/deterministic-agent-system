import crypto from "node:crypto";
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


function signWhatsAppBody(bodyText: string, appSecret: string): string {
  return "sha256=" + crypto.createHmac("sha256", appSecret).update(bodyText, "utf8").digest("hex");
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
          "x-request-id": "req-whatsapp-001",
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
  });

  it("logs successful delivery attempt with requestId and providerMessageId", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = createMockResponse();

    try {
      await handleWhatsAppWebhook(
        {
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-002",
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
      const payload = JSON.parse(logSpy.mock.calls[0][0]);
      expect(payload).toEqual(
        expect.objectContaining({
          subsystem: "whatsapp",
          event: "delivery.attempt",
          requestId: "req-whatsapp-002",
          channelMessageId: "wamid.HBgLN...",
          customerId: "5215512345678",
          duplicate: false,
          deliveryMode: "mock",
          deliveryStatus: "sent",
          providerMessageId: "mocked-whatsapp-message-001",
          deliveryError: null,
        })
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("logs failed delivery attempt with explicit delivery error", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = createMockResponse();

    try {
      await handleWhatsAppWebhook(
        {
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-003",
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
      const payload = JSON.parse(logSpy.mock.calls[0][0]);
      expect(payload).toEqual(
        expect.objectContaining({
          subsystem: "whatsapp",
          event: "delivery.attempt",
          requestId: "req-whatsapp-003",
          channelMessageId: "wamid.fail.001",
          customerId: "5215512345678",
          duplicate: false,
          deliveryMode: "http",
          deliveryStatus: "failed",
          providerMessageId: null,
          deliveryError: "whatsapp http send timed out",
        })
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("logs duplicate detection explicitly", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const firstRes = createMockResponse();
      await handleWhatsAppWebhook(
        {
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-004",
          },
        } as any,
        firstRes as any,
        {
          verifyToken: "token-123",
          store,
          bodyText: buildInboundBody("wamid.store.002", "Laptop X Pro"),
        }
      );

      const duplicateRes = createMockResponse();
      await handleWhatsAppWebhook(
        {
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-005",
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

      const payload = JSON.parse(logSpy.mock.calls[0][0]);
      expect(payload).toEqual(
        expect.objectContaining({
          subsystem: "whatsapp",
          event: "delivery.duplicate",
          requestId: "req-whatsapp-005",
          channelMessageId: "wamid.store.002",
          customerId: "5215512345678",
          duplicate: true,
          deliveryMode: "skipped",
          deliveryStatus: "skipped",
          providerMessageId: null,
          deliveryError: null,
        })
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("returns payment audit response when explicit businessContextId is provided without loadSession", async () => {
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
        businessContextId: "customer-service-payment-audit-v1",
        bodyText: buildInboundBody("wamid.payment.001", "What is the status of payment PMT-1001?"),
      }
    );

    const json = JSON.parse(res.getBody());

    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "consult-payment-status-resolved",
        resolvedIntentId: "consult-payment-status",
        stage: "resolve-payment-status",
        status: "resolved",
        outboundText:
          "Payment PMT-1001 is currently posted. Audit status: reconciled. No discrepancy has been detected at this time.",
        humanInterventionRequired: false,
      })
    );
    expect(json.results[0].agent.handoffReasonCode).toBeUndefined();
    expect(json.results[0].agent.handoffQueue).toBeUndefined();
    expect(json.results[0].session.businessContextId).toBe("customer-service-payment-audit-v1");
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
  it("keeps quote intake parity across whatsapp webhook multi-turn flow with stored session reuse", async () => {
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
          "x-request-id": "req-whatsapp-quote-001",
        },
      } as any,
      firstRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.store.001", "I need a quote for Personal Auto Standard"),
      }
    );

    const secondRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-quote-002",
        },
      } as any,
      secondRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.store.002", "California, call me"),
      }
    );

    const thirdRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-quote-003",
        },
      } as any,
      thirdRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.store.003", "commuting"),
      }
    );

    const fourthRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-quote-004",
        },
      } as any,
      fourthRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.store.004", "currently insured"),
      }
    );

    const fifthRes = createMockResponse();
    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-quote-005",
        },
      } as any,
      fifthRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.store.005", "2 drivers"),
      }
    );

    const firstJson = JSON.parse(firstRes.getBody());
    const secondJson = JSON.parse(secondRes.getBody());
    const thirdJson = JSON.parse(thirdRes.getBody());
    const fourthJson = JSON.parse(fourthRes.getBody());
    const fifthJson = JSON.parse(fifthRes.getBody());

    expect(firstJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        outboundText:
          "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review.",
        humanInterventionRequired: false,
      })
    );

    expect(secondJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        outboundText:
          "Quote intake started for Personal Auto Standard in CA. Please describe the primary vehicle use as personal, commute, business, or rideshare so a broker can continue the quote review.",
        humanInterventionRequired: false,
      })
    );

    expect(thirdJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        outboundText:
          "Quote intake started for Personal Auto Standard in CA. Please describe prior insurance status as insured, uninsured, or lapsed so a broker can continue the quote review.",
        humanInterventionRequired: false,
      })
    );

    expect(fourthJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        outboundText:
          "Quote intake started for Personal Auto Standard in CA. Please provide the number of household drivers as 1, 2, 3, 4, or 5+ so a broker can continue the quote review.",
        humanInterventionRequired: false,
      })
    );

    expect(fifthJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        outboundText:
          "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Prior insurance status: insured. Driver count: 2. Preferred contact: call.",
        humanInterventionRequired: false,
      })
    );

    expect(fifthJson.results[0].delivery).toEqual({
      mode: "skipped",
      result: null,
      deliveryStatus: "skipped",
      deliveryError: null,
    });
  });

  it("persists conversation evidence after a resolved whatsapp message", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-evidence-001",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.evidence.001", "What is the price of Personal Auto Standard?"),
      }
    );

    expect(store.loadEvidence("5215512345678")).toEqual({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.evidence.001",
      lastResponseId: "consult-price-resolved",
      lastResolvedIntentId: "consult-price",
      lastStage: "resolve-price",
      lastStatus: "resolved",
      lastOutboundText: "Product: Personal Auto Standard | Price: 128.50 USD",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("persists handoff evidence after a whatsapp handoff request", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const res = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-evidence-002",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.evidence.002", "I want to speak to a human agent"),
      }
    );

    expect(store.loadEvidence("5215512345678")).toEqual({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.evidence.002",
      lastResponseId: "handoff-requested",
      lastResolvedIntentId: "request-human-handoff",
      lastStage: "handoff-requested",
      lastStatus: "handoff",
      lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
      humanInterventionRequired: true,
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "licensed-broker",
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("lists open whatsapp handoffs through the HTTP route", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const handoffRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-handoff-open-001",
        },
      } as any,
      handoffRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.handoff.open.001", "I need to speak with a human agent"),
      }
    );

    const { routeRequest } = await import("../../src/http/routes");

    process.env.OPS_API_TOKEN = "ops-token-123";

    const listRes = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/handoffs",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      listRes as any,
      {
        whatsappStore: store,
      }
    );

    expect(listRes.statusCode).toBe(200);

    const json = JSON.parse(listRes.getBody());
    expect(json.ok).toBe(true);
    expect(json.count).toBe(1);
    expect(json.items).toEqual([
      expect.objectContaining({
        handoffId: "handoff:5215512345678:wamid.handoff.open.001",
        customerId: "5215512345678",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
        status: "open",
        lastInboundMessageId: "wamid.handoff.open.001",
        lastResponseId: "handoff-requested",
        lastResolvedIntentId: "request-human-handoff",
        lastStage: "handoff-requested",
        lastStatus: "handoff",
      }),
    ]);
  });

  it("closes a whatsapp handoff through the HTTP route", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const handoffRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-handoff-close-001",
        },
      } as any,
      handoffRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.handoff.close.001", "I need to speak with a human agent"),
      }
    );

    const { routeRequest } = await import("../../src/http/routes");

    process.env.OPS_API_TOKEN = "ops-token-123";

    const closeRes = createMockResponse();

    await routeRequest(
      {
        method: "POST",
        url: "/whatsapp/handoffs/" + encodeURIComponent("handoff:5215512345678:wamid.handoff.close.001") + "/close",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      closeRes as any,
      {
        whatsappStore: store,
      }
    );

    expect(closeRes.statusCode).toBe(200);

    const closeJson = JSON.parse(closeRes.getBody());
    expect(closeJson.ok).toBe(true);
    expect(closeJson.item).toEqual(
      expect.objectContaining({
        handoffId: "handoff:5215512345678:wamid.handoff.close.001",
        customerId: "5215512345678",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
        status: "closed",
        lastInboundMessageId: "wamid.handoff.close.001",
        lastResponseId: "handoff-requested",
        lastResolvedIntentId: "request-human-handoff",
        lastStage: "handoff-requested",
        lastStatus: "handoff",
      })
    );

    const listRes = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/handoffs",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      listRes as any,
      {
        whatsappStore: store,
      }
    );

    const listJson = JSON.parse(listRes.getBody());
    expect(listJson.ok).toBe(true);
    expect(listJson.count).toBe(0);
    expect(listJson.items).toEqual([]);
  });

  it("rejects whatsapp handoff listing without ops token", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");

    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/handoffs",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "x-ops-token header is required",
    });
  });

  it("accepts whatsapp webhook POST when appSecret signature is valid", async () => {
    const res = createMockResponse();
    const bodyText = buildInboundBody("wamid.signature.valid.001", "I need a quote for Personal Auto Standard");
    const appSecret = "app-secret-123";

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-hub-signature-256": signWhatsAppBody(bodyText, appSecret),
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        appSecret,
        bodyText,
      }
    );

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    expect(json.results[0].duplicate).toBe(false);
    expect(json.results[0].agent.responseId).toBe("request-quote-resolved");
  });

  it("rejects whatsapp webhook POST when appSecret signature is missing", async () => {
    const res = createMockResponse();
    const bodyText = buildInboundBody("wamid.signature.missing.001", "I need a quote for Personal Auto Standard");

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
        appSecret: "app-secret-123",
        bodyText,
      }
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "x-hub-signature-256 header is required",
    });
  });

  it("rejects whatsapp webhook POST when appSecret signature is invalid", async () => {
    const res = createMockResponse();
    const bodyText = buildInboundBody("wamid.signature.invalid.001", "I need a quote for Personal Auto Standard");

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-hub-signature-256": "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        appSecret: "app-secret-123",
        bodyText,
      }
    );

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "invalid whatsapp webhook signature",
    });
  });

  it("does not create handoff queue records for non-handoff responses even when session is already marked for handoff", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const previousHandoffRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-previous-handoff-001",
        },
      } as any,
      previousHandoffRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.previous.handoff.001", "I need to speak with a human agent"),
      }
    );

    expect(store.listHandoffs()).toHaveLength(1);

    const quoteRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-quote-after-handoff-001",
        },
      } as any,
      quoteRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.quote.after.handoff.001", "I need a quote for Personal Auto Standard"),
      }
    );

    const quoteJson = JSON.parse(quoteRes.getBody());

    expect(quoteJson.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
      })
    );

    expect(store.listHandoffs()).toHaveLength(1);
    expect(store.listHandoffs()[0].handoffId).toBe(
      "handoff:5215512345678:wamid.previous.handoff.001"
    );
  });

  it("persists conversation events for inbound outbound and handoff records", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    const quoteRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-events-001",
        },
      } as any,
      quoteRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.events.quote.001", "I need a quote for Personal Auto Standard"),
      }
    );

    expect(store.listConversationEvents("5215512345678")).toEqual([
      {
        eventId: "event:5215512345678:wamid.events.quote.001:inbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "inbound",
        channelMessageId: "wamid.events.quote.001",
        text: "I need a quote for Personal Auto Standard",
      },
      {
        eventId: "event:5215512345678:wamid.events.quote.001:outbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "outbound",
        channelMessageId: "wamid.events.quote.001",
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        text: "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review.",
      },
    ]);

    const handoffRes = createMockResponse();

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-events-002",
        },
      } as any,
      handoffRes as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.events.handoff.001", "I need to speak with a human agent"),
      }
    );

    expect(store.listConversationEvents("5215512345678")).toEqual([
      {
        eventId: "event:5215512345678:wamid.events.quote.001:inbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "inbound",
        channelMessageId: "wamid.events.quote.001",
        text: "I need a quote for Personal Auto Standard",
      },
      {
        eventId: "event:5215512345678:wamid.events.quote.001:outbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "outbound",
        channelMessageId: "wamid.events.quote.001",
        responseId: "request-quote-resolved",
        resolvedIntentId: "request-quote",
        stage: "resolve-quote-intake",
        status: "resolved",
        text: "Quote intake started for Personal Auto Standard. Please provide the state where coverage is needed so a broker can continue the quote review.",
      },
      {
        eventId: "event:5215512345678:wamid.events.handoff.001:inbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "inbound",
        channelMessageId: "wamid.events.handoff.001",
        text: "I need to speak with a human agent",
      },
      {
        eventId: "event:5215512345678:wamid.events.handoff.001:outbound",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "outbound",
        channelMessageId: "wamid.events.handoff.001",
        responseId: "handoff-requested",
        resolvedIntentId: "request-human-handoff",
        stage: "handoff-requested",
        status: "handoff",
        text: "Your conversation will be transferred to a licensed broker specialist.",
      },
      {
        eventId: "event:5215512345678:wamid.events.handoff.001:handoff",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "handoff",
        channelMessageId: "wamid.events.handoff.001",
        responseId: "handoff-requested",
        resolvedIntentId: "request-human-handoff",
        stage: "handoff-requested",
        status: "handoff",
        text: "Your conversation will be transferred to a licensed broker specialist.",
        handoffId: "handoff:5215512345678:wamid.events.handoff.001",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
      },
    ]);
  });

  it("lists whatsapp conversation events through the HTTP route", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-http-events-001",
        },
      } as any,
      createMockResponse() as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.http.events.001", "I need to speak with a human agent"),
      }
    );

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");
    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/events",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.getBody());
    expect(json.ok).toBe(true);
    expect(json.customerId).toBe("5215512345678");
    expect(json.count).toBe(3);
    expect(json.items).toEqual([
      expect.objectContaining({
        kind: "inbound",
        channelMessageId: "wamid.http.events.001",
        text: "I need to speak with a human agent",
      }),
      expect.objectContaining({
        kind: "outbound",
        channelMessageId: "wamid.http.events.001",
        responseId: "handoff-requested",
        resolvedIntentId: "request-human-handoff",
        stage: "handoff-requested",
        status: "handoff",
      }),
      expect.objectContaining({
        kind: "handoff",
        channelMessageId: "wamid.http.events.001",
        handoffId: "handoff:5215512345678:wamid.http.events.001",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
      }),
    ]);
  });

  it("rejects whatsapp conversation events route without ops token", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");
    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/events",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "x-ops-token header is required",
    });
  });

  it("returns whatsapp conversation evidence through the HTTP route", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    await handleWhatsAppWebhook(
      {
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-http-evidence-001",
        },
      } as any,
      createMockResponse() as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.http.evidence.001", "I need to speak with a human agent"),
      }
    );

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");
    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/evidence",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.getBody());
    expect(json).toEqual({
      ok: true,
      customerId: "5215512345678",
      evidence: {
        customerId: "5215512345678",
        lastInboundMessageId: "wamid.http.evidence.001",
        lastResponseId: "handoff-requested",
        lastResolvedIntentId: "request-human-handoff",
        lastStage: "handoff-requested",
        lastStatus: "handoff",
        lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
        humanInterventionRequired: true,
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
        updatedAtIso: "2026-03-24T00:00:00.000Z",
      },
    });
  });

  it("rejects whatsapp conversation evidence route without ops token", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");
    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/evidence",
        headers: {
          host: "localhost:3000",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "x-ops-token header is required",
    });
  });

  it("returns not found for missing whatsapp conversation evidence", async () => {
    const store = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });

    process.env.OPS_API_TOKEN = "ops-token-123";

    const { routeRequest } = await import("../../src/http/routes");
    const res = createMockResponse();

    await routeRequest(
      {
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/evidence",
        headers: {
          host: "localhost:3000",
          "x-ops-token": "ops-token-123",
        },
      } as any,
      res as any,
      {
        whatsappStore: store,
      }
    );

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "conversation evidence not found",
      customerId: "5215512345678",
    });
  });
});