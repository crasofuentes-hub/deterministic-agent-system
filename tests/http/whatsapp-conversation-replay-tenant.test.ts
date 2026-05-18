import { describe, expect, it } from "vitest";
import { createInMemoryExecutionJournal } from "../../src/journal";
import { handleGetWhatsAppConversationReplay } from "../../src/http/handlers/whatsapp-conversation-replay";

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
  };
}

describe("whatsapp conversation replay tenant ownership", () => {
  it("rejects cross-tenant replay access", async () => {
    const journal = createInMemoryExecutionJournal();

    await journal.appendEvent({
      eventId: "journal:customer-001:message-001:received",
      sessionId: "whatsapp:customer-001",
      timestamp: "2026-05-14T00:00:00.000Z",
      type: "message_received",
      payload: {
        tenantId: "tenant-a",
        customerId: "customer-001",
        text: "hello",
      },
    });

    const response = createMockResponse();

    await handleGetWhatsAppConversationReplay(
      response as any,
      journal,
      "customer-001",
      {
        tenantId: "tenant-b",
        subjectId: "api-key-tenant-b",
        scopes: ["replay:read"],
      },
    );

    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.getBody());
    expect(body).toMatchObject({
      ok: false,
      sessionId: "whatsapp:customer-001",
      error: {
        code: "REPLAY_TENANT_MISMATCH",
        expectedTenantId: "tenant-b",
        actualTenantId: "tenant-a",
      },
    });
  });

  it("rejects explicit replay tenant id without request identity fields", async () => {
    const journal = createInMemoryExecutionJournal();

    await journal.appendEvent({
      eventId: "journal:customer-003:message-001:received",
      sessionId: "whatsapp:customer-003",
      timestamp: "2026-05-14T00:00:00.000Z",
      type: "message_received",
      payload: {
        tenantId: "tenant-a",
        customerId: "customer-003",
        text: "hello",
      },
    });

    const response = createMockResponse();

    await handleGetWhatsAppConversationReplay(
      response as any,
      journal,
      "customer-003",
      {
        tenantId: "tenant-a",
      },
    );

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.getBody());
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Request validation failed: subjectId must be provided as a string",
        retryable: false,
      },
    });
  });

  it("allows replay access for the owning tenant", async () => {
    const journal = createInMemoryExecutionJournal();

    await journal.appendEvent({
      eventId: "journal:customer-002:message-001:received",
      sessionId: "whatsapp:customer-002",
      timestamp: "2026-05-14T00:00:00.000Z",
      type: "message_received",
      payload: {
        tenantId: "tenant-a",
        customerId: "customer-002",
        text: "hello",
      },
    });

    const response = createMockResponse();

    await handleGetWhatsAppConversationReplay(
      response as any,
      journal,
      "customer-002",
      {
        tenantId: "tenant-a",
        subjectId: "api-key-tenant-a",
        scopes: ["replay:read"],
      },
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });
});