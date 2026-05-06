import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import { handleAsyncWhatsAppWebhook } from "../../src/http/handlers/whatsapp-webhook-async";
import { createInMemoryExecutionJournal } from "../../src/journal";

class MockRequest extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;

  constructor(params: {
    readonly method: string;
    readonly url: string;
    readonly headers?: Record<string, string>;
  }) {
    super();
    this.method = params.method;
    this.url = params.url;
    this.headers = params.headers ?? {};
  }
}

class MockResponse {
  statusCode = 200;
  private readonly headers: Record<string, string> = {};
  private body = "";

  setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  end(value?: string): void {
    this.body = value ?? "";
  }

  getBody(): string {
    return this.body;
  }

  getHeaders(): Record<string, string> {
    return this.headers;
  }
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

describe("async whatsapp webhook journal integration", () => {
  it("records tamper-evident received and processed events for async whatsapp messages", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);
    const journal = createInMemoryExecutionJournal();

    const request = new MockRequest({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: {
        "x-request-id": "req-journal-coverage-001",
      },
    });
    const response = new MockResponse();

    await handleAsyncWhatsAppWebhook(request as any, response as any, {
      verifyToken: "token-123",
      bodyText: buildInboundBody("wamid.journal.coverage.001", "Coverage details for POL-AUTO-1001"),
      deliveryMode: "skipped",
      store,
      journal,
    });

    const json = JSON.parse(response.getBody());

    expect(response.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results[0].duplicate).toBe(false);

    await expect(journal.verifyChain("whatsapp:5215512345678")).resolves.toBe(true);

    const sessionJournal = await journal.getSessionJournal("whatsapp:5215512345678", {
      integrityCheck: true,
    });

    expect(sessionJournal.integrityOk).toBe(true);
    expect(sessionJournal.events.map((event) => event.type)).toEqual([
      "message_received",
      "message_processed",
    ]);

    expect(sessionJournal.events.map((event) => event.eventId)).toEqual([
      "journal:5215512345678:wamid.journal.coverage.001:received",
      "journal:5215512345678:wamid.journal.coverage.001:processed",
    ]);

    expect(sessionJournal.events[0]).toMatchObject({
      sessionId: "whatsapp:5215512345678",
      sequence: 1,
      hashPrev: null,
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.journal.coverage.001",
        text: "Coverage details for POL-AUTO-1001",
      },
      metadata: {
        requestId: "req-journal-coverage-001",
      },
    });

    expect(sessionJournal.events[1]).toMatchObject({
      sessionId: "whatsapp:5215512345678",
      sequence: 2,
      hashPrev: sessionJournal.events[0].hashSelf,
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.journal.coverage.001",
        duplicate: false,
        deliveryStatus: "skipped",
        responseId: "consult-coverage-resolved",
        resolvedIntentId: "consult-coverage",
        stage: "resolve-coverage",
        status: "resolved",
        humanInterventionRequired: false,
      },
      metadata: {
        requestId: "req-journal-coverage-001",
      },
    });
  });

  it("records duplicate message processing in the same journal chain", async () => {
    const syncStore = createInMemoryWhatsAppStore({
      businessContextId: "customer-service-core-v2",
    });
    const store = adaptSyncWhatsAppStoreToAsync(syncStore);
    const journal = createInMemoryExecutionJournal();

    const bodyText = buildInboundBody("wamid.journal.duplicate.001", "Coverage details for POL-AUTO-1001");

    const firstResponse = new MockResponse();
    await handleAsyncWhatsAppWebhook(
      new MockRequest({
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          "x-request-id": "req-journal-duplicate-001",
        },
      }) as any,
      firstResponse as any,
      {
        verifyToken: "token-123",
        bodyText,
        deliveryMode: "skipped",
        store,
        journal,
      },
    );

    const secondResponse = new MockResponse();
    await handleAsyncWhatsAppWebhook(
      new MockRequest({
        method: "POST",
        url: "/webhooks/whatsapp",
        headers: {
          "x-request-id": "req-journal-duplicate-002",
        },
      }) as any,
      secondResponse as any,
      {
        verifyToken: "token-123",
        bodyText,
        deliveryMode: "skipped",
        store,
        journal,
      },
    );

    const secondJson = JSON.parse(secondResponse.getBody());
    expect(secondJson.results[0].duplicate).toBe(true);

    const sessionJournal = await journal.getSessionJournal("whatsapp:5215512345678", {
      integrityCheck: true,
    });

    expect(sessionJournal.integrityOk).toBe(true);
    expect(sessionJournal.events.map((event) => event.type)).toEqual([
      "message_received",
      "message_processed",
      "message_received",
      "message_processed",
    ]);

    expect(sessionJournal.events[3]).toMatchObject({
      sequence: 4,
      type: "message_processed",
      payload: {
        duplicate: true,
        deliveryStatus: "skipped",
        responseId: null,
        resolvedIntentId: null,
        stage: null,
        status: null,
        humanInterventionRequired: null,
      },
      metadata: {
        requestId: "req-journal-duplicate-002",
      },
    });
  });
});