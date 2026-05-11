import { describe, expect, it } from "vitest";
import {
  bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan,
  bridgeVerifiedPlannerOutputToAgentPlan,
} from "../../src/agent-run";
import type { PlannerPromptOutput, PlannerToolDefinition } from "../../src/prompts";

const tools: readonly PlannerToolDefinition[] = [
  {
    name: "customer.lookup",
    description: "Look up a customer by customer id.",
    parametersSchema: {
      type: "object",
      required: ["customerId"],
      additionalProperties: false,
      properties: {
        customerId: {
          type: "string",
        },
      },
    },
  },
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

const executablePlannerOutput: PlannerPromptOutput = {
  decisionSummary: "Use customer lookup, then coverage lookup.",
  requiresClarification: false,
  clarificationQuestion: null,
  assumptions: [],
  missingInputs: [],
  steps: [
    {
      step: 1,
      tool: "customer.lookup",
      parameters: {
        customerId: "CUST-001",
      },
      explanation: "Retrieve customer context.",
    },
    {
      step: 2,
      tool: "policy.coverage.get",
      parameters: {
        policyId: "POL-AUTO-1001",
      },
      explanation: "Retrieve coverage details.",
      dependsOn: [1],
    },
  ],
};

describe("llm-live verified planner prompt bridge", () => {
  it("bridges verified planner output to a canonical deterministic agent plan", () => {
    const plan = bridgeVerifiedPlannerOutputToAgentPlan({
      planId: "agent-run-llm-live-verified-planner-v1",
      plannerOutput: executablePlannerOutput,
    });

    expect(plan).toEqual({
      planId: "agent-run-llm-live-verified-planner-v1",
      version: 1,
      steps: [
        {
          id: "tool_0001",
          kind: "tool.call",
          toolId: "customer.lookup",
          input: {
            customerId: "CUST-001",
          },
          outputKey: "step_1",
        },
        {
          id: "tool_0002",
          kind: "tool.call",
          toolId: "policy.coverage.get",
          input: {
            policyId: "POL-AUTO-1001",
          },
          outputKey: "step_2",
        },
      ],
    });
  });

  it("bridges verified planner prompt text through contract validation and verifier", () => {
    const text = JSON.stringify(executablePlannerOutput);

    const plan = bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan({
      text,
      planId: "agent-run-llm-live-verified-text-v1",
      availableTools: tools,
      maxSteps: 4,
    });

    expect(plan.planId).toBe("agent-run-llm-live-verified-text-v1");
    expect(plan.version).toBe(1);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]).toMatchObject({
      id: "tool_0001",
      kind: "tool.call",
      toolId: "customer.lookup",
      outputKey: "step_1",
    });
    expect(plan.steps[1]).toMatchObject({
      id: "tool_0002",
      kind: "tool.call",
      toolId: "policy.coverage.get",
      outputKey: "step_2",
    });
  });

  it("supports deterministic custom step id and output key prefixes", () => {
    const plan = bridgeVerifiedPlannerOutputToAgentPlan({
      planId: "agent-run-llm-live-custom-prefix-v1",
      plannerOutput: executablePlannerOutput,
      stepIdPrefix: "planner",
      outputKeyPrefix: "plannerResult",
    });

    expect(plan.steps.map((step) => step.id)).toEqual(["planner_0001", "planner_0002"]);
    expect(plan.steps.map((step) => step.outputKey)).toEqual(["plannerResult_1", "plannerResult_2"]);
  });

  it("rejects clarification planner output before producing an agent plan", () => {
    expect(() =>
      bridgeVerifiedPlannerOutputToAgentPlan({
        planId: "agent-run-llm-live-clarification-v1",
        plannerOutput: {
          decisionSummary: "The request is missing a policy id.",
          requiresClarification: true,
          clarificationQuestion: "Which policy id should I use?",
          assumptions: [],
          missingInputs: ["policyId"],
          steps: [],
        },
      }),
    ).toThrow("llm_live_planner_bridge_requires_executable_plan");
  });

  it("rejects invalid planner prompt text before bridge output is produced", () => {
    const text = JSON.stringify({
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
    });

    expect(() =>
      bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan({
        text,
        planId: "agent-run-llm-live-invalid-tool-v1",
        availableTools: tools,
      }),
    ).toThrow(/LLM_LIVE_PLANNER_CONTRACT_INVALID/);
  });
});