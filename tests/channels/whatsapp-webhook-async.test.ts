import { describe, expect, it, vi } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import { handleAsyncWhatsAppWebhook } from "../../src/http/handlers/whatsapp-webhook-async";

function createMockResponse() {
  let body = "";
  const headers: Record<string, string> = {};

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(value?: string) {
      body = value ?? "";
    },
    getBody() {
      return body;
    },
    getHeaders() {
      return headers;
    },
  };
}

function buildInboundBody(messageId: string, userText: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-001",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
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
                  text: {
                    body: userText,
                  },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

describe("async whatsapp webhook handler", () => {
  it("returns challenge for valid verification request", async () => {
    const res = createMockResponse();

    await handleAsyncWhatsAppWebhook(
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
    expect(res.getBody()).toBe("abc123");
    expect(res.getHeaders()["content-type"]).toBe("text/plain; charset=utf-8");
  });

  it("returns insurance coverage lookup response through async whatsapp webhook", async () => {
    const res = createMockResponse();

    await handleAsyncWhatsAppWebhook(
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-async-coverage-001",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        businessContextId: "customer-service-core-v2",
        bodyText: buildInboundBody("wamid.async.coverage.001", "Coverage details for POL-AUTO-1001"),
      }
    );

    const json = JSON.parse(res.getBody());

    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.messagesReceived).toBe(1);
    expect(json.results[0].duplicate).toBe(false);
    expect(json.results[0].agent).toEqual(
      expect.objectContaining({
        responseId: "consult-coverage-resolved",
        resolvedIntentId: "consult-coverage",
        stage: "resolve-coverage",
        status: "resolved",
        humanInterventionRequired: false,
      })
    );
    expect(json.results[0].agent.outboundText).toContain("Policy NMA-****-1001 for Maria Alvarez");
    expect(json.results[0].agent.outboundText).toContain("Carrier: Northwind Mutual Auto");
    expect(json.results[0].agent.outboundText).toContain("Selected coverages: 7 of 8");
  });

  it("persists insurance coverage evidence through async store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);
    const res = createMockResponse();

    await handleAsyncWhatsAppWebhook(
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          "x-request-id": "req-whatsapp-async-coverage-evidence-001",
        },
      } as any,
      res as any,
      {
        verifyToken: "token-123",
        store,
        bodyText: buildInboundBody("wamid.async.coverage.evidence.001", "Coverage details for POL-AUTO-1001"),
      }
    );

    const evidence = await store.loadEvidence("5215512345678");

    expect(evidence).toEqual(
      expect.objectContaining({
        customerId: "5215512345678",
        lastInboundMessageId: "wamid.async.coverage.evidence.001",
        lastResponseId: "consult-coverage-resolved",
        lastResolvedIntentId: "consult-coverage",
        lastStage: "resolve-coverage",
        lastStatus: "resolved",
        humanInterventionRequired: false,
        handoffReasonCode: undefined,
        handoffQueue: undefined,
        updatedAtIso: "2026-03-24T00:00:00.000Z",
      })
    );

    expect(evidence?.lastOutboundText).toContain("Policy NMA-****-1001 for Maria Alvarez");
    expect(evidence?.lastOutboundText).toContain("Carrier: Northwind Mutual Auto");
    expect(evidence?.lastOutboundText).toContain("Selected coverages: 7 of 8");
  });

  it("logs duplicate detection explicitly through async store", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const firstRes = createMockResponse();

      await handleAsyncWhatsAppWebhook(
        {
          method: "POST",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-async-duplicate-001",
          },
        } as any,
        firstRes as any,
        {
          verifyToken: "token-123",
          store,
          bodyText: buildInboundBody("wamid.async.duplicate.001", "Coverage details for POL-AUTO-1001"),
        }
      );

      const duplicateRes = createMockResponse();

      await handleAsyncWhatsAppWebhook(
        {
          method: "POST",
          headers: {
            host: "localhost:3000",
            "x-request-id": "req-whatsapp-async-duplicate-002",
          },
        } as any,
        duplicateRes as any,
        {
          verifyToken: "token-123",
          store,
          bodyText: buildInboundBody("wamid.async.duplicate.001", "Coverage details for POL-AUTO-1001"),
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

      const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string);

      expect(payload).toEqual(
        expect.objectContaining({
          subsystem: "whatsapp",
          event: "delivery.duplicate",
          requestId: "req-whatsapp-async-duplicate-002",
          channelMessageId: "wamid.async.duplicate.001",
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
});