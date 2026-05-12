import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("verified planner prompt mode explicit architecture guard", () => {
  it("keeps deterministic-agent-plan as the default llm-live plan text format", () => {
    const source = read("src/agent-run/planner-llm-live.ts");

    expect(source).toContain('export function materializePlanFromLlmPlanText');
    expect(source).toContain('typeof input.llmPlanTextFormat === "string"');
    expect(source).toContain(': "deterministic-agent-plan"');
    expect(source).toContain('if (format === "planner-prompt-output")');
    expect(source).toContain('if (format !== "deterministic-agent-plan")');
    expect(source).toContain('return parseDeterministicPlanFromModelText(planText);');
  });

  it("requires declared planner tools before planner-prompt-output can be bridged", () => {
    const source = read("src/agent-run/planner-llm-live.ts");

    expect(source).toContain("llmPlannerAvailableTools");
    expect(source).toContain("availableTools.length === 0");
    expect(source).toContain("llm_live_verified_planner_prompt_tools_required");
    expect(source).toContain("bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan");
  });

  it("passes verified planner fields through the http agent run input parser explicitly", () => {
    const source = read("src/http/handlers/agent-run.ts");

    expect(source).toContain("const llmPlanTextFormat = body.llmPlanTextFormat;");
    expect(source).toContain("const llmPlannerAvailableTools = body.llmPlannerAvailableTools;");
    expect(source).toContain("const llmVerifiedPlanId = body.llmVerifiedPlanId;");
    expect(source).toContain('llmPlanTextFormat === "deterministic-agent-plan"');
    expect(source).toContain('llmPlanTextFormat === "planner-prompt-output"');
    expect(source).toContain("llmPlannerAvailableTools: Array.isArray(llmPlannerAvailableTools)");
    expect(source).toContain('typeof llmVerifiedPlanId === "string"');
  });

  it("documents the input schema for verified planner prompt mode without making it required", () => {
    const source = read("src/http/handlers/schema-agent-run.ts");

    expect(source).toContain("llmPlanTextFormat");
    expect(source).toContain('"deterministic-agent-plan"');
    expect(source).toContain('"planner-prompt-output"');
    expect(source).toContain("llmPlannerAvailableTools");
    expect(source).toContain("llmVerifiedPlanId");

    expect(source).toContain('required: ["goal", "demo", "mode", "maxSteps"]');
    expect(source).not.toContain('required: ["goal", "demo", "mode", "maxSteps", "llmPlanTextFormat"]');
  });
});