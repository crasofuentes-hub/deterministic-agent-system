import { describe, expect, it } from "vitest";
import { buildCapabilitySynthPlan } from "../../src/agent-run/capability-pipeline";
import { normalizeCapabilityPipelineDetailed } from "../../src/agent-run/capability-preconditions";

describe("capability-insertion-trace", () => {
  it("reports inserted capabilities for merge-only request", () => {
    expect(
      normalizeCapabilityPipelineDetailed(["json.merge"])
    ).toEqual({
      capabilities: ["json.extract", "json.select", "json.merge"],
      inserted: ["json.extract", "json.select"],
    });
  });

  it("appends deterministic inserted-capabilities log to plan", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "merge user fields",
      intent: "cap-synth",
      capabilities: ["json.merge"],
    });

    expect(plan.steps).toContainEqual({
      id: "z",
      kind: "append_log",
      value: "capabilities:auto-inserted:json.extract,json.select",
    });
  });

  it("does not append insertion log when nothing was inserted", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "extract user",
      intent: "extract",
      capabilities: ["json.extract"],
    });

    const insertionLogs = plan.steps.filter(
      (step) =>
        step.kind === "append_log" &&
        typeof step.value === "string" &&
        step.value.startsWith("capabilities:auto-inserted:")
    );

    expect(insertionLogs).toEqual([]);
  });
});