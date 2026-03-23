import { describe, expect, it } from "vitest";
import { DetToolsPlanner } from "../../src/agent-run/planner-det-tools";

describe("planner-det-tools domain", () => {
  it("builds price lookup plan for product pricing goal", () => {
    const planner = new DetToolsPlanner();

    const plan = planner.plan({
      goal: "What is the price of Wireless Mouse M1?",
      demo: "core",
      mode: "mock",
      maxSteps: 20,
      planner: "det-tools",
      traceId: "planner-det-tools-price",
    });

    const toolStep = plan.steps.find((step) => step.kind === "tool.call");
    expect(toolStep).toMatchObject({
      toolId: "catalog/price-find",
      input: {
        productName: "Wireless Mouse M1",
      },
      outputKey: "priceLookup",
    });
  });

  it("builds order lookup plan for order-status goal", () => {
    const planner = new DetToolsPlanner();

    const plan = planner.plan({
      goal: "What is the status of order ORDER-55555?",
      demo: "core",
      mode: "mock",
      maxSteps: 20,
      planner: "det-tools",
      traceId: "planner-det-tools-order",
    });

    const toolStep = plan.steps.find((step) => step.kind === "tool.call");
    expect(toolStep).toMatchObject({
      toolId: "orders/find-by-id",
      input: {
        orderId: "ORDER-55555",
      },
      outputKey: "orderLookup",
    });
  });
});