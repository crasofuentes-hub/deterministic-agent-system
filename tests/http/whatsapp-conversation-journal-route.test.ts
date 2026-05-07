import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import type { AsyncWhatsAppRuntimeConfig } from "../../src/channels/whatsapp/runtime-async";
import { routeRequest } from "../../src/http/routes";
import { resetRateLimitStateForTests } from "../../src/http/handlers/rate-limit";
import { createInMemoryExecutionJournal } from "../../src/journal";

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
  readonly headers?: Record<string, string>;
}) {
  const req = Readable.from([""]) as unknown as {
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

function createAsyncRuntimeWithJournal(): AsyncWhatsAppRuntimeConfig {
  const syncStore = createInMemoryWhatsAppStore({
    businessContextId: "customer-service-core-v2",
  });

  return {
    verifyToken: "token-123",
    deliveryMode: "skipped",
    store: adaptSyncWhatsAppStoreToAsync(syncStore),
    journal: createInMemoryExecutionJournal(),
    async close() {},
  };
}

describe("whatsapp conversation journal ops route", () => {
  const previousOpsToken = process.env.OPS_API_TOKEN;

  afterEach(() => {
    resetRateLimitStateForTests();

    if (typeof previousOpsToken === "string") {
      process.env.OPS_API_TOKEN = previousOpsToken;
    } else {
      delete process.env.OPS_API_TOKEN;
    }
  });

  it("returns a tamper-evident whatsapp session journal through the protected ops route", async () => {
    process.env.OPS_API_TOKEN = "ops-token-123";

    const asyncRuntime = createAsyncRuntimeWithJournal();

    await asyncRuntime.journal.appendEvent({
      eventId: "journal:5215512345678:wamid.ops.journal.001:received",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T01:00:00.000Z",
      type: "message_received",
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.ops.journal.001",
        text: "Coverage details for POL-AUTO-1001",
      },
      metadata: {
        requestId: "req-ops-journal-001",
      },
    });

    await asyncRuntime.journal.appendEvent({
      eventId: "journal:5215512345678:wamid.ops.journal.001:processed",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T01:00:01.000Z",
      type: "message_processed",
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.ops.journal.001",
        duplicate: false,
        deliveryStatus: "skipped",
        responseId: "consult-coverage-resolved",
        resolvedIntentId: "consult-coverage",
        stage: "resolve-coverage",
        status: "resolved",
        humanInterventionRequired: false,
      },
      metadata: {
        requestId: "req-ops-journal-001",
      },
    });

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/journal",
        headers: {
          "x-ops-token": "ops-token-123",
        },
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: asyncRuntime,
      },
    );

    expect(res.statusCode).toBe(200);

    const json = JSON.parse(res.getBody());

    expect(json).toEqual({
      ok: true,
      customerId: "5215512345678",
      sessionId: "whatsapp:5215512345678",
      integrityOk: true,
      count: 2,
      events: [
        expect.objectContaining({
          eventId: "journal:5215512345678:wamid.ops.journal.001:received",
          sessionId: "whatsapp:5215512345678",
          sequence: 1,
          type: "message_received",
          hashPrev: null,
          payload: {
            channel: "whatsapp",
            customerId: "5215512345678",
            channelMessageId: "wamid.ops.journal.001",
            text: "Coverage details for POL-AUTO-1001",
          },
          metadata: {
            requestId: "req-ops-journal-001",
          },
        }),
        expect.objectContaining({
          eventId: "journal:5215512345678:wamid.ops.journal.001:processed",
          sessionId: "whatsapp:5215512345678",
          sequence: 2,
          type: "message_processed",
          payload: {
            channel: "whatsapp",
            customerId: "5215512345678",
            channelMessageId: "wamid.ops.journal.001",
            duplicate: false,
            deliveryStatus: "skipped",
            responseId: "consult-coverage-resolved",
            resolvedIntentId: "consult-coverage",
            stage: "resolve-coverage",
            status: "resolved",
            humanInterventionRequired: false,
          },
          metadata: {
            requestId: "req-ops-journal-001",
          },
        }),
      ],
    });

    expect(json.events[0].hashSelf).toMatch(/^[a-f0-9]{64}$/);
    expect(json.events[1].hashPrev).toBe(json.events[0].hashSelf);
    expect(json.events[1].hashSelf).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects whatsapp session journal route without ops token", async () => {
    process.env.OPS_API_TOKEN = "ops-token-123";

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/journal",
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: createAsyncRuntimeWithJournal(),
      },
    );

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "x-ops-token header is required",
    });
  });

  it("returns deterministic configuration error when journal is not configured", async () => {
    process.env.OPS_API_TOKEN = "ops-token-123";

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/journal",
        headers: {
          "x-ops-token": "ops-token-123",
        },
      }) as any,
      res as any,
      {},
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      error: "whatsapp journal is not configured",
      meta: {
        requestId: expect.any(String),
      },
    });
  });
});