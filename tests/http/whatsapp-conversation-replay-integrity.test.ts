import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryWhatsAppStore } from "../../src/channels/whatsapp/store";
import { adaptSyncWhatsAppStoreToAsync } from "../../src/channels/whatsapp/store-async";
import type { AsyncWhatsAppRuntimeConfig } from "../../src/channels/whatsapp/runtime-async";
import { routeRequest } from "../../src/http/routes";
import { resetRateLimitStateForTests } from "../../src/http/handlers/rate-limit";
import type {
  AppendJournalEventInput,
  ExecutionJournal,
  GetSessionJournalOptions,
  SessionJournal,
  StoredJournalEvent,
} from "../../src/journal";

function createMockResponse() {
  let body = "";
  const headers: Record<string, string> = {};

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
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
  readonly body?: string;
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

function createBrokenJournal(): ExecutionJournal {
  const tamperedEvent: StoredJournalEvent = {
    eventId: "journal:5215512345678:tampered:processed",
    sessionId: "whatsapp:5215512345678",
    sequence: 1,
    timestamp: "2026-05-06T01:00:00.000Z",
    type: "message_processed",
    payload: {
        tenantId: "local-dev",
      status: "tampered",
    },
    hashPrev: null,
    hashSelf: "not-a-valid-event-hash",
  };

  return {
    async appendEvent(_event: AppendJournalEventInput): Promise<StoredJournalEvent> {
      throw new Error("appendEvent is not used by this test");
    },

    async verifyChain(_sessionId: string): Promise<boolean> {
      return false;
    },

    async getSessionJournal(
      sessionId: string,
      _options?: GetSessionJournalOptions,
    ): Promise<SessionJournal> {
      return {
        sessionId,
        integrityOk: false,
        events: [tamperedEvent],
      };
    },
  };
}

function createAsyncRuntimeWithBrokenJournal(): AsyncWhatsAppRuntimeConfig {
  const syncStore = createInMemoryWhatsAppStore({
    businessContextId: "customer-service-core-v2",
  });

  return {
    verifyToken: "token-123",
    deliveryMode: "skipped",
    store: adaptSyncWhatsAppStoreToAsync(syncStore),
    journal: createBrokenJournal(),
    async close() {},
  };
}

describe("whatsapp replay ops route integrity failures", () => {
  const previousOpsToken = process.env.OPS_API_TOKEN;

  afterEach(() => {
    resetRateLimitStateForTests();

    if (typeof previousOpsToken === "string") {
      process.env.OPS_API_TOKEN = previousOpsToken;
    } else {
      delete process.env.OPS_API_TOKEN;
    }
  });

  it("rejects full replay when journal integrity fails", async () => {
    process.env.OPS_API_TOKEN = "ops-token-123";

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "GET",
        url: "/whatsapp/conversations/5215512345678/replay",
        headers: {
          "x-ops-token": "ops-token-123",
        },
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: createAsyncRuntimeWithBrokenJournal(),
      },
    );

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      customerId: "5215512345678",
      sessionId: "whatsapp:5215512345678",
      integrityOk: false,
      error: {
        code: "JOURNAL_INTEGRITY_CHECK_FAILED",
        message: "Journal integrity check failed for session: whatsapp:5215512345678",
      },
    });
  });

  it("rejects replay override when journal integrity fails", async () => {
    process.env.OPS_API_TOKEN = "ops-token-123";

    const res = createMockResponse();

    await routeRequest(
      createMockRequest({
        method: "POST",
        url: "/whatsapp/conversations/5215512345678/replay",
        headers: {
          "x-ops-token": "ops-token-123",
        },
        body: JSON.stringify({
          overrides: [
            {
              sequence: 1,
              payload: {
        tenantId: "local-dev",
                status: "override",
              },
            },
          ],
        }),
      }) as any,
      res as any,
      {
        asyncWhatsAppRuntime: createAsyncRuntimeWithBrokenJournal(),
      },
    );

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.getBody())).toEqual({
      ok: false,
      customerId: "5215512345678",
      sessionId: "whatsapp:5215512345678",
      integrityOk: false,
      error: {
        code: "JOURNAL_INTEGRITY_CHECK_FAILED",
        message: "Journal integrity check failed for session: whatsapp:5215512345678",
      },
    });
  });
});