import { describe, expect, it } from "vitest";
import { runAgent } from "../../src/agent-run/run";
import { buildPlannerLlmMock } from "../../src/agent-run/planner-llm-mock";

describe("runAgent domain result", () => {
  it("projects real price result into final state", async () => {
    const planner = buildPlannerLlmMock();

    const response = await runAgent(
      {
        goal: "What is the price of Laptop X Pro?",
        mode: "mock",
        maxSteps: 20,
        traceId: "price-domain-result",
      },
      planner
    );

    expect(response.ok).toBe(true);
    expect(response.output.finalState.values.priceLookup).toBeDefined();
    expect(response.output.finalState.values.domainResult).toBe(
      "Product: Laptop X Pro | Price: 1499.99 USD"
    );
  });

  it("projects real order result into final state", async () => {
    const planner = buildPlannerLlmMock();

    const response = await runAgent(
      {
        goal: "What is the status of order ORDER-12345?",
        mode: "mock",
        maxSteps: 20,
        traceId: "order-domain-result",
      },
      planner
    );

    expect(response.ok).toBe(true);
    expect(response.output.finalState.values.orderLookup).toBeDefined();
    expect(response.output.finalState.values.domainResult).toBe(
      "Order ID: ORDER-12345 | Status: processing | Updated: 2026-03-10T10:00:00Z"
    );
  });
});