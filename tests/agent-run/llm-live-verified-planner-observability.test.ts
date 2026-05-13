import { afterEach, describe, expect, it, vi } from "vitest";
import { materializePlanFromLlmPlanText } from "../../src/agent-run/planner-llm-live";
import type { AgentRunInput } from "../../src/agent-run";

const tools = [
  {
    name: "math/add",
    description: "Add two numbers deterministically.",
    parametersSchema: {
      type: "object",
      required: ["a", "b"],
      additionalProperties: false,
      properties: {
        a: {
          type: "number",
        },
        b: {
          type: "number",
        },
      },
    },
  },
];

function baseInput(overrides: Partial<AgentRunInput>): AgentRunInput {
  return {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    planner: "llm-live",
    maxSteps: 8,
    traceId: "trace-verified-planner-observability",
    ...overrides,
  };
}

function captureStdout(): string[] {
  const writes: string[] = [];

  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
    writes.push(String(chunk));
    return true;
  });

  return writes;
}

function parseLlmLiveEvents(writes: readonly string[]): readonly Record<string, unknown>[] {
  return writes
    .join("")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((event) => event.subsystem === "llm-live");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("llm-live verified planner observability", () => {
  it("emits received, verified, and bridge events for valid verified planner output", () => {
    const writes = captureStdout();

    const plan = materializePlanFromLlmPlanText(
      baseInput({
        llmPlanTextFormat: "planner-prompt-output",
        llmVerifiedPlanId: "verified-observability-plan-v1",
        llmPlannerAvailableTools: tools,
        llmPlanText: JSON.stringify({
          decisionSummary: "The request includes two numbers, so math/add is sufficient.",
          requiresClarification: false,
          clarificationQuestion: null,
          assumptions: [],
          missingInputs: [],
          steps: [
            {
              step: 1,
              tool: "math/add",
              parameters: {
                a: 2,
                b: 3,
              },
              explanation: "Compute deterministic sum.",
            },
          ],
        }),
      }),
    );

    expect(plan.planId).toBe("verified-observability-plan-v1");

    const events = parseLlmLiveEvents(writes);

    expect(events.map((event) => event.event)).toEqual([
      "llm_live.planner_prompt.received",
      "llm_live.planner_prompt.verified",
      "llm_live.planner_bridge.created_plan",
    ]);

    expect(events[0]).toMatchObject({
      subsystem: "llm-live",
      event: "llm_live.planner_prompt.received",
      traceId: "trace-verified-planner-observability",
      llmPlanTextFormat: "planner-prompt-output",
      promptContractId: "planner.deterministic",
      promptContractVersion: "1.1.0",
      toolNames: ["math/add"],
    });

    expect(events[1]).toMatchObject({
      event: "llm_live.planner_prompt.verified",
      planId: "verified-observability-plan-v1",
      executable: true,
      toolNames: ["math/add"],
    });

    expect(events[2]).toMatchObject({
      event: "llm_live.planner_bridge.created_plan",
      planId: "verified-observability-plan-v1",
      stepCount: 1,
    });
  });

  it("emits rejected event for invalid verified planner output", () => {
    const writes = captureStdout();

    expect(() =>
      materializePlanFromLlmPlanText(
        baseInput({
          llmPlanTextFormat: "planner-prompt-output",
          llmPlannerAvailableTools: tools,
          llmPlanText: JSON.stringify({
            decisionSummary: "Use invented tool.",
            requiresClarification: false,
            clarificationQuestion: null,
            assumptions: [],
            missingInputs: [],
            steps: [
              {
                step: 1,
                tool: "invented.tool",
                parameters: {},
                explanation: "This must fail.",
              },
            ],
          }),
        }),
      ),
    ).toThrow(/llm_live_invalid_plan_text: LLM_LIVE_PLANNER_CONTRACT_INVALID/);

    const events = parseLlmLiveEvents(writes);

    expect(events.map((event) => event.event)).toEqual([
      "llm_live.planner_prompt.received",
      "llm_live.planner_prompt.rejected",
    ]);

    expect(events[1]).toMatchObject({
      event: "llm_live.planner_prompt.rejected",
      traceId: "trace-verified-planner-observability",
      errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
      issueCount: 1,
      toolNames: ["math/add"],
    });
  });

  it("does not emit verified planner events for classic deterministic-agent-plan mode", () => {
    const writes = captureStdout();

    materializePlanFromLlmPlanText(
      baseInput({
        llmPlanText: JSON.stringify({
          planId: "classic-plan-v1",
          version: 1,
          steps: [
            {
              id: "a",
              kind: "append_log",
              value: "done",
            },
          ],
        }),
      }),
    );

    expect(parseLlmLiveEvents(writes)).toEqual([]);
  });
});