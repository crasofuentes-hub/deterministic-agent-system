import { describe, expect, it } from "vitest";
import { handleAgentRun } from "../../src/http/handlers/agent-run";

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

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    planner: "mock",
    maxSteps: 8,
    traceId: "trace-agent-run-http-tenant-context-001",
    ...overrides,
  };
}

describe("http agent run tenant context", () => {
  it("rejects an explicit tenant id without request identity fields", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        tenantId: "tenant-acme-prod",
      }),
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

  it("accepts authenticated request identity fields", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        tenantId: "tenant-acme-prod",
        subjectId: "api-key-main",
        scopes: ["agent:run", "journal:read"],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });

  it("rejects explicit tenant identity without subject id", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        tenantId: "tenant-acme-prod",
        scopes: ["agent:run"],
      }),
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
  it("allows local dev fallback when tenant id is omitted", async () => {
    const response = createMockResponse();

    await handleAgentRun(response as any, baseRequest());

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });

  it("rejects invalid tenant ids deterministically", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        tenantId: "../bad tenant",
      }),
    );

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.getBody());
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message:
          "Request validation failed: tenantId must start with an alphanumeric character and may contain only alphanumeric characters, dot, underscore, colon, or hyphen; max length is 128",
        retryable: false,
      },
    });
  });
});