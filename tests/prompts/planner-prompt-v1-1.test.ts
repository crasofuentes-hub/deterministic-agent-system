import { describe, expect, it } from "vitest";
import {
  PLANNER_PROMPT_ID,
  PLANNER_PROMPT_VERSION_V1_1,
  createPromptRegistry,
  deterministicPlannerPromptContract,
  deterministicPlannerPromptContractV1_1,
} from "../../src/prompts";

const tools = [
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

describe("deterministic planner prompt v1.1", () => {
  it("renders a senior planner prompt with strong sections and visible examples", () => {
    const messages = deterministicPlannerPromptContractV1_1.render({
      userRequest: "Get coverage for policy POL-AUTO-1001",
      availableTools: tools,
      maxSteps: 4,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("<role>");
    expect(messages[0].content).toContain("<mission>");
    expect(messages[0].content).toContain("<non_negotiable_rules>");
    expect(messages[0].content).toContain("<tool_selection_policy>");
    expect(messages[0].content).toContain("<clarification_policy>");
    expect(messages[0].content).toContain("<output_contract>");
    expect(messages[0].content).toContain("<few_shot_examples>");
    expect(messages[0].content).toContain("<private_final_self_check>");
    expect(messages[0].content).toContain("You are the planning layer of a deterministic, auditable agent runtime.");
    expect(messages[0].content).toContain("Reason privately before answering");
    expect(messages[0].content).toContain("Do not expose chain-of-thought");
    expect(messages[0].content).toContain('"tool": "policy.coverage.get"');
    expect(messages[0].content).toContain('"requiresClarification": true');
    expect(messages[0].content).toContain('"dependsOn": [1]');
    expect(messages[1].content).toContain("POL-AUTO-1001");
  });

  it("keeps the same output validator contract as v1.0", () => {
    const result = deterministicPlannerPromptContractV1_1.validateOutput({
      decisionSummary: "The request includes a policy id.",
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
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        requiresClarification: false,
        steps: [
          {
            step: 1,
            tool: "policy.coverage.get",
          },
        ],
      },
    });
  });

  it("registers v1.0 and v1.1 as separate prompt contract versions", () => {
    const registry = createPromptRegistry([
      deterministicPlannerPromptContract,
      deterministicPlannerPromptContractV1_1,
    ]);

    expect(registry.get(PLANNER_PROMPT_ID, "1.0.0")).toBe(deterministicPlannerPromptContract);
    expect(registry.get(PLANNER_PROMPT_ID, PLANNER_PROMPT_VERSION_V1_1)).toBe(
      deterministicPlannerPromptContractV1_1,
    );
    expect(registry.list().map((contract) => contract.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("rejects invalid render inputs deterministically", () => {
    expect(() =>
      deterministicPlannerPromptContractV1_1.render({
        userRequest: "",
        availableTools: tools,
      }),
    ).toThrow("userRequest must be a non-empty string");

    expect(() =>
      deterministicPlannerPromptContractV1_1.render({
        userRequest: "Get coverage",
        availableTools: [],
      }),
    ).toThrow("availableTools must be a non-empty array");
  });
});