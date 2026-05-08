import { describe, expect, it } from "vitest";
import {
  assertVerifiedLlmLivePlannerPromptText,
  verifyLlmLivePlannerPromptText,
} from "../../src/agent-run";

const tools = [
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
  {
    name: "customer.lookup",
    description: "Look up a customer by id.",
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
];

describe("llm-live planner prompt contract boundary", () => {
  it("accepts verified planner prompt output text", () => {
    const text = JSON.stringify({
      decisionSummary: "Use coverage lookup because the policy id is present.",
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
          explanation: "Retrieve deterministic coverage information.",
        },
      ],
    });

    const result = verifyLlmLivePlannerPromptText({
      text,
      availableTools: tools,
      requireExecutablePlan: true,
    });

    expect(result).toMatchObject({
      ok: true,
      executable: true,
      plannerOutput: {
        decisionSummary: "Use coverage lookup because the policy id is present.",
        steps: [
          {
            step: 1,
            tool: "policy.coverage.get",
          },
        ],
      },
      normalizedToolNames: ["customer.lookup", "policy.coverage.get"],
    });
  });

  it("accepts clarification output when executable plan is not required", () => {
    const text = JSON.stringify({
      decisionSummary: "The request is missing a policy id.",
      requiresClarification: true,
      clarificationQuestion: "Which policy id should I use?",
      assumptions: [],
      missingInputs: ["policyId"],
      steps: [],
    });

    const result = verifyLlmLivePlannerPromptText({
      text,
      availableTools: tools,
      requireExecutablePlan: false,
    });

    expect(result).toMatchObject({
      ok: true,
      executable: false,
      plannerOutput: {
        requiresClarification: true,
        clarificationQuestion: "Which policy id should I use?",
      },
    });
  });

  it("rejects malformed JSON deterministically", () => {
    const result = verifyLlmLivePlannerPromptText({
      text: "{ invalid json",
      availableTools: tools,
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        retryable: false,
        issues: [
          {
            code: "PLAN_SCHEMA_INVALID",
            path: "$",
          },
        ],
      },
    });

    if (result.ok) {
      throw new Error("Expected invalid result");
    }

    expect(result.error.message).toMatch(/^llm_live_planner_contract_invalid_json:/);
  });

  it("rejects hidden reasoning fields deterministically", () => {
    const text = JSON.stringify({
      reasoning: "hidden reasoning must not be accepted",
      decisionSummary: "Use coverage lookup.",
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
          explanation: "Retrieve deterministic coverage information.",
        },
      ],
    });

    const result = verifyLlmLivePlannerPromptText({
      text,
      availableTools: tools,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        message: 'Unknown property "reasoning" at $',
        retryable: false,
        issues: [
          {
            code: "PLAN_SCHEMA_INVALID",
            message: 'Unknown property "reasoning" at $',
            path: "$",
          },
        ],
      },
    });
  });

  it("rejects invented tools deterministically", () => {
    const text = JSON.stringify({
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
    });

    const result = verifyLlmLivePlannerPromptText({
      text,
      availableTools: tools,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        message: "Planner output failed deterministic verification",
        retryable: false,
        issues: [
          {
            code: "PLAN_SCHEMA_INVALID",
            message: "tool is not declared in available tools: invented.tool",
            path: "$.steps[0].tool",
          },
        ],
      },
    });
  });

  it("assert helper throws deterministic invalid contract errors", () => {
    expect(() =>
      assertVerifiedLlmLivePlannerPromptText({
        text: JSON.stringify({
          decisionSummary: "Missing executable steps.",
          requiresClarification: false,
          clarificationQuestion: null,
          assumptions: [],
          missingInputs: [],
          steps: [],
        }),
        availableTools: tools,
      }),
    ).toThrow(/LLM_LIVE_PLANNER_CONTRACT_INVALID:/);
  });
});