import { describe, expect, it } from "vitest";
import { materializePlanFromLlmPlanText } from "../../src/agent-run/planner-llm-live";
import type { AgentRunInput } from "../../src/agent-run";
import type { PlannerToolDefinition } from "../../src/prompts";

const tools: readonly PlannerToolDefinition[] = [
  {
    name: "policy.coverage.get",
    description: "Get coverage details for a policy.",
    parametersSchema: {
      type: "object",
      required: ["policyId"],
      additionalProperties: false,
      properties: {
        policyId: {
          type: "string",
        },
      },
    },
  },
];

function baseInput(overrides: Partial<AgentRunInput>): AgentRunInput {
  return {
    goal: "get coverage for policy POL-AUTO-1001",
    demo: "core",
    mode: "mock",
    planner: "llm-live",
    maxSteps: 8,
    traceId: "trace-llm-live-verified-planner-input-mode",
    ...overrides,
  };
}

describe("llm-live verified planner prompt input mode", () => {
  it("keeps classic deterministic agent plan text mode as the default", () => {
    const plan = materializePlanFromLlmPlanText(
      baseInput({
        llmPlanText: JSON.stringify({
          planId: "classic-plan-v1",
          version: 1,
          steps: [
            {
              id: "b",
              kind: "append_log",
              value: "done",
            },
            {
              id: "a",
              kind: "set",
              key: "goal",
              value: "sum 2 3",
            },
          ],
        }),
      }),
    );

    expect(plan).toEqual({
      planId: "classic-plan-v1",
      version: 1,
      steps: [
        {
          id: "a",
          kind: "set",
          key: "goal",
          value: "sum 2 3",
        },
        {
          id: "b",
          kind: "append_log",
          value: "done",
        },
      ],
    });
  });

  it("bridges verified planner prompt output when planner-prompt-output mode is explicit", () => {
    const plan = materializePlanFromLlmPlanText(
      baseInput({
        llmPlanTextFormat: "planner-prompt-output",
        llmVerifiedPlanId: "verified-planner-mode-v1",
        llmPlannerAvailableTools: tools,
        llmPlanText: JSON.stringify({
          decisionSummary: "The policy id is present, so coverage lookup is executable.",
          requiresClarification: false,
          clarificationQuestion: null,
          assumptions: [],
          missingInputs: [],
          steps: [
            {
              step: 1,
              tool: "policy.coverage.get",
              parameters: {
                policyId: "POL-AUTO-1001",
              },
              explanation: "Retrieve deterministic coverage details.",
            },
          ],
        }),
      }),
    );

    expect(plan).toEqual({
      planId: "verified-planner-mode-v1",
      version: 1,
      steps: [
        {
          id: "llm_tool_0001",
          kind: "tool.call",
          toolId: "policy.coverage.get",
          input: {
            policyId: "POL-AUTO-1001",
          },
          outputKey: "llm_step_1",
        },
      ],
    });
  });

  it("rejects planner-prompt-output mode without declared planner tools", () => {
    expect(() =>
      materializePlanFromLlmPlanText(
        baseInput({
          llmPlanTextFormat: "planner-prompt-output",
          llmPlanText: JSON.stringify({
            decisionSummary: "No tools declared.",
            requiresClarification: false,
            clarificationQuestion: null,
            assumptions: [],
            missingInputs: [],
            steps: [
              {
                step: 1,
                tool: "policy.coverage.get",
                parameters: {
                  policyId: "POL-AUTO-1001",
                },
                explanation: "Retrieve deterministic coverage details.",
              },
            ],
          }),
        }),
      ),
    ).toThrow("llm_live_verified_planner_prompt_tools_required");
  });

  it("rejects invalid verified planner prompt output before producing a plan", () => {
    expect(() =>
      materializePlanFromLlmPlanText(
        baseInput({
          llmPlanTextFormat: "planner-prompt-output",
          llmPlannerAvailableTools: tools,
          llmPlanText: JSON.stringify({
            decisionSummary: "Use an invented tool.",
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
    ).toThrow(/LLM_LIVE_PLANNER_CONTRACT_INVALID/);
  });
});