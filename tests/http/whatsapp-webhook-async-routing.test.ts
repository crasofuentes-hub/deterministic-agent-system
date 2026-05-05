import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import type { AsyncWhatsAppRuntimeConfig } from "../../src/channels/whatsapp/runtime-async";
import { routeRequest } from "../../src/http/routes";

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

function createMockRequest(options: {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
  readonly headers?: Record<string, string>;
}) {
  const req = Readable.from([options.body ?? ""]) as unknown as {
    method: string;
    url: string;
    headers: Record<string, string>;
  };

  req.method = options.method;
  req.url = options.url;
  req.headers = {
    host: "localhost:3000",
    ...options.headers,
  };

  return req;
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

describe("async whatsapp webhook routing", () => {
  it("routes whatsapp verification through explicit async runtime options", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const asyncStore = adaptSyncWhatsAppStoreToAsync(syncStore);

    const asyncRuntime: AsyncWhatsAppRuntimeConfig = {
      verifyToken: "token-123",
      deliveryMode: "skipped",
      store: asyncStore,
      async close() {},
    };

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "GET",
        url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=async-route-ok",
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: asyncRuntime,
      }
    );

    expect(res.statusCode).toBe(200);
    expect(res.getBody()).toBe("async-route-ok");
    expect(res.getHeaders()["content-type"]).toBe("text/plain; charset=utf-8");
  });

  it("routes whatsapp POST through explicit async runtime options and persists evidence", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const asyncStore = adaptSyncWhatsAppStoreToAsync(syncStore);

    const asyncRuntime: AsyncWhatsAppRuntimeConfig = {
      verifyToken: "token-123",
      deliveryMode: "skipped",
      store: asyncStore,
      async close() {},
    };

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          "x-request-id": "req-async-route-coverage-001",
        },
        body: buildInboundBody("wamid.async.route.coverage.001", "Coverage details for POL-AUTO-1001"),
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: asyncRuntime,
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

    await expect(asyncStore.loadEvidence("5215512345678")).resolves.toEqual(
      expect.objectContaining({
        customerId: "5215512345678",
        lastInboundMessageId: "wamid.async.route.coverage.001",
        lastResponseId: "consult-coverage-resolved",
        lastResolvedIntentId: "consult-coverage",
        lastStage: "resolve-coverage",
        lastStatus: "resolved",
        humanInterventionRequired: false,
      })
    );
  });
});