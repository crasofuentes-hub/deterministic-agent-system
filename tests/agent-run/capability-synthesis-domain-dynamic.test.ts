import { describe, expect, it } from "vitest";
import { buildCapabilitySynthPlan } from "../../src/agent-run/capability-pipeline";

describe("capability synthesis domain dynamic values", () => {
  it("builds price plan with product name from goal", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "What is the price of Wireless Mouse M1?",
      intent: "cap-synth",
      capabilities: ["catalog.price-find"],
    });

    const toolStep = plan.steps.find((step) => step.kind === "tool.call");
    expect(toolStep).toMatchObject({
      toolId: "catalog/price-find",
      input: {
        productName: "Wireless Mouse M1",
      },
    });
  });

  it("builds order plan with order id from goal", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "What is the status of order ORDER-55555?",
      intent: "cap-synth",
      capabilities: ["orders.find-by-id"],
    });

    const toolStep = plan.steps.find((step) => step.kind === "tool.call");
    expect(toolStep).toMatchObject({
      toolId: "orders/find-by-id",
      input: {
        orderId: "ORDER-55555",
      },
    });
  });
});