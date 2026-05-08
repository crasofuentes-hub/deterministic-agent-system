import { describe, expect, it } from "vitest";
import { verifyDeterministicPlan } from "../../src/planner";
import type { PlannerToolDefinition } from "../../src/prompts";

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
        includeLimits: {
          type: "boolean",
        },
      },
    },
  },
  {
    name: "ticket.create",
    description: "Create a support ticket.",
    parametersSchema: {
      type: "object",
      required: ["priority"],
      additionalProperties: false,
      properties: {
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
      },
    },
  },
];

describe("deterministic plan verifier", () => {
  it("accepts an executable plan with valid tool parameters", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "Use the coverage tool because the policy id is present.",
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
              includeLimits: true,
            },
            explanation: "Retrieve deterministic coverage details.",
          },
        ],
      },
      {
        availableTools: tools,
        requireExecutablePlan: true,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      executable: true,
      normalizedToolNames: ["customer.lookup", "policy.coverage.get", "ticket.create"],
    });
  });

  it("accepts a clarification plan when executable plan is not required", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "The request is missing a policy id.",
        requiresClarification: true,
        clarificationQuestion: "Which policy id should I use?",
        assumptions: [],
        missingInputs: ["policyId"],
        steps: [],
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      executable: false,
    });
  });

  it("rejects clarification plans when executable plan is required", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "The request is missing a policy id.",
        requiresClarification: true,
        clarificationQuestion: "Which policy id should I use?",
        assumptions: [],
        missingInputs: ["policyId"],
        steps: [],
      },
      {
        availableTools: tools,
        requireExecutablePlan: true,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_REQUIRES_CLARIFICATION",
          message: "Plan requires clarification and is not executable",
          path: "$.requiresClarification",
        },
      ],
    });
  });

  it("rejects invented tools through prompt schema validation", () => {
    const result = verifyDeterministicPlan(
      {
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
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_SCHEMA_INVALID",
          message: "tool is not declared in available tools: invented.tool",
          path: "$.steps[0].tool",
        },
      ],
    });
  });

  it("rejects missing required tool parameters", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "Try coverage lookup without a policy id.",
        requiresClarification: false,
        clarificationQuestion: null,
        assumptions: [],
        missingInputs: [],
        steps: [
          {
            step: 1,
            tool: "policy.coverage.get",
            parameters: {
              includeLimits: true,
            },
            explanation: "This must fail because policyId is required.",
          },
        ],
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_TOOL_PARAMETERS_INVALID",
          message: "Missing required tool parameter: policyId",
          path: "$.steps[0].parameters.policyId",
        },
      ],
    });
  });

  it("rejects unknown tool parameters when additionalProperties is false", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "Try coverage lookup with unknown parameter.",
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
              unknown: true,
            },
            explanation: "This must fail because unknown is not declared.",
          },
        ],
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_TOOL_PARAMETERS_INVALID",
          message: "Unknown tool parameter: unknown",
          path: "$.steps[0].parameters.unknown",
        },
      ],
    });
  });

  it("rejects enum violations in tool parameters", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "Try ticket creation with invalid priority.",
        requiresClarification: false,
        clarificationQuestion: null,
        assumptions: [],
        missingInputs: [],
        steps: [
          {
            step: 1,
            tool: "ticket.create",
            parameters: {
              priority: "urgent",
            },
            explanation: "This must fail because urgent is not in enum.",
          },
        ],
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_TOOL_PARAMETERS_INVALID",
          message: "Parameter value is not one of the allowed enum values",
          path: "$.steps[0].parameters.priority",
        },
      ],
    });
  });

  it("rejects duplicate dependencies", () => {
    const result = verifyDeterministicPlan(
      {
        decisionSummary: "Use two-step plan with duplicate dependencies.",
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
            explanation: "Look up customer.",
          },
          {
            step: 2,
            tool: "policy.coverage.get",
            parameters: {
              policyId: "POL-AUTO-1001",
            },
            explanation: "Get coverage.",
            dependsOn: [1, 1],
          },
        ],
      },
      {
        availableTools: tools,
      },
    );

    expect(result).toEqual({
      ok: false,
      executable: false,
      issues: [
        {
          code: "PLAN_DEPENDENCY_INVALID",
          message: "dependsOn entries must not contain duplicates",
          path: "$.steps[1].dependsOn",
        },
      ],
    });
  });
});