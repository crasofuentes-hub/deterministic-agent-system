import { describe, expect, it } from "vitest";
import { buildCapabilitySynthPlan } from "../../src/agent-run/capability-pipeline";

describe("capability-pipeline-metadata", () => {
  it("emits canonical metadata for merge-only request", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "merge user fields",
      intent: "cap-synth",
      capabilities: ["json.merge"],
    });

    expect(plan.metadata).toEqual({
      requestedCapabilities: ["json.merge"],
      normalizedCapabilities: ["json.extract", "json.select", "json.merge"],
      autoInsertedCapabilities: ["json.extract", "json.select"],
      pipelineFamily: "json-merge",
    });
  });

  it("emits canonical metadata for select-only request", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "select user fields",
      intent: "cap-synth",
      capabilities: ["json.select"],
    });

    expect(plan.metadata).toEqual({
      requestedCapabilities: ["json.select"],
      normalizedCapabilities: ["json.extract", "json.select"],
      autoInsertedCapabilities: ["json.extract"],
      pipelineFamily: "json-select",
    });
  });

  it("emits empty auto-inserted list when nothing was inserted", () => {
    const plan = buildCapabilitySynthPlan({
      plannerPrefix: "llm-mock",
      goal: "extract user",
      intent: "extract",
      capabilities: ["json.extract"],
    });

    expect(plan.metadata).toEqual({
      requestedCapabilities: ["json.extract"],
      normalizedCapabilities: ["json.extract"],
      autoInsertedCapabilities: [],
      pipelineFamily: "json-extract",
    });
  });
});