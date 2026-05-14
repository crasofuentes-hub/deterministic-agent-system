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
    traceId: "trace-agent-run-http-queue-mode-001",
    ...overrides,
  };
}

describe("http agent run queue mode", () => {
  it("keeps direct execution as the default", async () => {
    const response = createMockResponse();

    await handleAgentRun(response as any, baseRequest());

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });

  it("supports explicit inline queue execution mode", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        executionMode: "inline-queue",
        traceId: "trace-agent-run-http-inline-queue-001",
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });

  it("rejects unknown execution mode deterministically", async () => {
    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      baseRequest({
        executionMode: "background-worker",
      }),
    );

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.getBody());
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message:
          'Request validation failed: executionMode must be "direct" or "inline-queue" when provided',
        retryable: false,
      },
    });
  });
});