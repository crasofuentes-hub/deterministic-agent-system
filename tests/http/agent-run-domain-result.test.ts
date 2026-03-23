import { describe, expect, it } from "vitest";
import { handleAgentRun } from "../../src/http/handlers/agent-run";

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  end(chunk?: string) {
    this.body = typeof chunk === "string" ? chunk : "";
  }
}

describe("http /agent/run domainResult", () => {
  it("exposes domainResult for price query", async () => {
    const res = new MockResponse();

    await handleAgentRun(res as any, {
      goal: "What is the price of Laptop X Pro?",
      demo: "core",
      mode: "mock",
      maxSteps: 20,
      planner: "llm-mock",
      traceId: "http-domain-result-price",
    });

    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.domainResult).toBe("Product: Laptop X Pro | Price: 1499.99 USD");
    expect(json.output.finalState.values.domainResult).toBe("Product: Laptop X Pro | Price: 1499.99 USD");
  });
});