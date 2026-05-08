import { describe, expect, it } from "vitest";
import {
  PLANNER_PROMPT_ID,
  PLANNER_PROMPT_VERSION,
  createPromptRegistry,
  deterministicPlannerPromptContract,
  validatePlannerPromptOutput,
} from "../../src/prompts";

const tools = [
  {
    name: "customer.lookup",
    description: "Look up a customer by customer id.",
    parametersSchema: {
      type: "object",
      required: ["customerId"],
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
      properties: {
        policyId: {
          type: "string",
        },
      },
    },
  },
];

describe("deterministic planner prompt contract", () => {
  it("renders a professional bounded planner prompt with tools and examples", () => {
    const messages = deterministicPlannerPromptContract.render({
      userRequest: "Get coverage details for policy POL-AUTO-1001",
      availableTools: tools,
      maxSteps: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "system",
    });
    expect(messages[0].content).toContain("You are a deterministic planning component.");
    expect(messages[0].content).toContain("Return JSON only.");
    expect(messages[0].content).toContain("Do not include hidden reasoning or chain-of-thought.");
    expect(messages[0].content).toContain("customer.lookup");
    expect(messages[0].content).toContain("policy.coverage.get");
    expect(messages[0].content).toContain("few_shot_examples");
    expect(messages[1]).toMatchObject({
      role: "user",
    });
    expect(messages[1].content).toContain("POL-AUTO-1001");
  });

  it("validates a correct executable planner output", () => {
    const result = validatePlannerPromptOutput(
      {
        decisionSummary: "Use the coverage tool because the request includes a policy id.",
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
            explanation: "Retrieve deterministic coverage details for the provided policy id.",
          },
        ],
      },
      {
        allowedToolNames: tools.map((tool) => tool.name),
        maxSteps: 3,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        steps: [
          {
            step: 1,
            tool: "policy.coverage.get",
          },
        ],
      },
    });
  });

  it("validates clarification outputs without executable steps", () => {
    const result = deterministicPlannerPromptContract.validateOutput({
      decisionSummary: "The request is missing a customer or policy identifier.",
      requiresClarification: true,
      clarificationQuestion: "Which policy id should I use?",
      assumptions: [],
      missingInputs: ["policyId"],
      steps: [],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        requiresClarification: true,
        clarificationQuestion: "Which policy id should I use?",
        steps: [],
      },
    });
  });

  it("rejects invented tools when allowed tool names are provided", () => {
    const result = validatePlannerPromptOutput(
      {
        decisionSummary: "Try to use a non-existent tool.",
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
        allowedToolNames: tools.map((tool) => tool.name),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROMPT_OUTPUT_INVALID",
        message: "tool is not declared in available tools: invented.tool",
        path: "$.steps[0].tool",
      },
    });
  });

  it("rejects hidden reasoning fields and unknown output keys", () => {
    const result = validatePlannerPromptOutput({
      reasoning: "This field is intentionally forbidden.",
      decisionSummary: "Use a valid operational summary instead.",
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
          explanation: "Look up the customer.",
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROMPT_OUTPUT_INVALID",
        message: 'Unknown property "reasoning" at $',
        path: "$",
      },
    });
  });

  it("rejects invalid step dependencies", () => {
    const result = validatePlannerPromptOutput({
      decisionSummary: "Invalid dependency points forward.",
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
          explanation: "Look up the customer.",
          dependsOn: [1],
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROMPT_OUTPUT_INVALID",
        message: "dependsOn entries must reference prior step numbers",
        path: "$.steps[0].dependsOn",
      },
    });
  });

  it("registers prompt contracts and rejects duplicate id/version pairs", () => {
    const registry = createPromptRegistry([deterministicPlannerPromptContract]);

    expect(registry.get(PLANNER_PROMPT_ID, PLANNER_PROMPT_VERSION)).toBe(
      deterministicPlannerPromptContract,
    );

    expect(() => registry.register(deterministicPlannerPromptContract)).toThrow(
      "Prompt contract already registered: planner.deterministic@1.0.0",
    );

    expect(registry.list().map((contract) => contract.id)).toEqual(["planner.deterministic"]);
  });
});