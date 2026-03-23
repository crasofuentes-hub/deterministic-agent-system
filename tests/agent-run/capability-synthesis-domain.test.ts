import { describe, expect, it } from "vitest";
import { buildCapabilitySynthPlan } from "../../src/agent-run/capability-pipeline";
import { deriveIntent } from "../../src/agent-run/spec";
import { synthesizeCapabilitiesFromGoal } from "../../src/agent-run/capability-synthesis";

describe("capability synthesis domain", () => {
  it("routes price goals into cap-synth intent", () => {
    expect(deriveIntent("What is the price of Laptop X Pro?")).toBe("cap-synth");
  });

  it("synthesizes price capability from goal", () => {
    expect(synthesizeCapabilitiesFromGoal("What is the price of Laptop X Pro?")).toEqual([
      "catalog.price-find",
    ]);
  });

  it("synthesizes availability capability from goal", () => {
    expect(synthesizeCapabilitiesFromGoal("Check availability for Laptop X Pro")).toEqual([
      "catalog.availability-find",
    ]);
  });

  it("synthesizes order capability from goal", () => {
    expect(synthesizeCapabilitiesFromGoal("What is the status of order ORDER-12345?")).toEqual([
      "orders.find-by-id",
    ]);
  });

  it("builds deterministic plan for price lookup", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "What is the price of Laptop X Pro?",
      intent: "cap-synth",
      capabilities: ["catalog.price-find"],
    });

    const toolSteps = plan.steps.filter((step) => step.kind === "tool.call");
    expect(toolSteps).toHaveLength(1);
    expect(toolSteps[0]).toMatchObject({
      toolId: "catalog/price-find",
      outputKey: "priceLookup",
      input: {
        productName: "Laptop X Pro",
      },
    });
  });

  it("builds deterministic plan for order lookup", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "What is the status of order ORDER-12345?",
      intent: "cap-synth",
      capabilities: ["orders.find-by-id"],
    });

    const toolSteps = plan.steps.filter((step) => step.kind === "tool.call");
    expect(toolSteps).toHaveLength(1);
    expect(toolSteps[0]).toMatchObject({
      toolId: "orders/find-by-id",
      outputKey: "orderLookup",
      input: {
        orderId: "ORDER-12345",
      },
    });
  });
});