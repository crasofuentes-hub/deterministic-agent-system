import type { PromptMessage, VersionedPromptContract } from "../contracts";
import {
  PLANNER_PROMPT_ID,
  type PlannerPromptInput,
  type PlannerPromptOutput,
  type PlannerToolDefinition,
  validatePlannerPromptOutput,
} from "./planner-contract";

export const PLANNER_PROMPT_VERSION_V1_1 = "1.1.0";
export const PLANNER_PROMPT_SCHEMA_NAME_V1_1 = "DeterministicPlannerOutputV1";

function renderAvailableTools(tools: readonly PlannerToolDefinition[]): string {
  return JSON.stringify(
    [...tools]
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersSchema: tool.parametersSchema,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    null,
    2,
  );
}

function assertPlannerPromptInput(input: PlannerPromptInput): void {
  if (typeof input.userRequest !== "string" || input.userRequest.trim().length === 0) {
    throw new Error("userRequest must be a non-empty string");
  }

  if (!Array.isArray(input.availableTools) || input.availableTools.length === 0) {
    throw new Error("availableTools must be a non-empty array");
  }

  for (const tool of input.availableTools) {
    if (typeof tool.name !== "string" || tool.name.trim().length === 0) {
      throw new Error("availableTools[].name must be a non-empty string");
    }

    if (typeof tool.description !== "string" || tool.description.trim().length === 0) {
      throw new Error("availableTools[].description must be a non-empty string");
    }

    if (
      typeof tool.parametersSchema !== "object" ||
      tool.parametersSchema === null ||
      Array.isArray(tool.parametersSchema)
    ) {
      throw new Error("availableTools[].parametersSchema must be an object");
    }
  }
}

function renderDeterministicPlannerPromptV1_1(input: PlannerPromptInput): readonly PromptMessage[] {
  assertPlannerPromptInput(input);

  const maxSteps =
    typeof input.maxSteps === "number" && Number.isSafeInteger(input.maxSteps) && input.maxSteps > 0
      ? input.maxSteps
      : 8;

  const boundedContext =
    typeof input.context === "string" && input.context.trim().length > 0
      ? "\n\n<context>\n" + input.context.trim() + "\n</context>"
      : "";

  const systemPrompt = [
    "<role>",
    "You are the planning layer of a deterministic, auditable agent runtime.",
    "Your output will be parsed, validated, verified, hashed, and rejected if it violates contract.",
    "You do not execute tools. You only produce a candidate plan.",
    "</role>",
    "",
    "<mission>",
    "Create the smallest precise executable plan that can satisfy the user request using only the provided tools.",
    "If the request lacks critical information, produce a clarification response instead of guessing.",
    "</mission>",
    "",
    "<non_negotiable_rules>",
    "- Return JSON only. Do not wrap the response in markdown.",
    "- Do not expose chain-of-thought or hidden reasoning.",
    "- Reason privately before answering, then return only the contractual JSON.",
    "- Use decisionSummary for a concise operational justification.",
    "- Use only tools listed in <available_tools>.",
    "- Never invent tools, parameters, schemas, capabilities, customer facts, policy facts, or external data.",
    "- Every executable step must call exactly one tool.",
    "- Step numbers must start at 1 and increment by 1.",
    "- dependsOn may only reference prior step numbers.",
    "- If clarification is required, requiresClarification must be true and steps must be empty.",
    "- If executable, requiresClarification must be false and clarificationQuestion must be null.",
    "- Do not exceed " + String(maxSteps) + " steps.",
    "</non_negotiable_rules>",
    "",
    "<tool_selection_policy>",
    "- Prefer the most specific tool that directly satisfies the request.",
    "- Do not use a tool only because it is available.",
    "- Do not split one atomic tool call into multiple steps.",
    "- Use dependsOn only when a later step truly needs a prior step result.",
    "- Keep parameters minimal and schema-compatible.",
    "</tool_selection_policy>",
    "",
    "<clarification_policy>",
    "- Ask for clarification when a required identifier or required decision is missing.",
    "- Do not create placeholder ids.",
    "- Do not assume customer, account, policy, order, payment, or claim identifiers.",
    "- Put missing required inputs in missingInputs.",
    "</clarification_policy>",
    "",
    "<output_contract>",
    "{",
    '  "decisionSummary": "string",',
    '  "requiresClarification": false,',
    '  "clarificationQuestion": null,',
    '  "assumptions": ["string"],',
    '  "missingInputs": ["string"],',
    '  "steps": [',
    "    {",
    '      "step": 1,',
    '      "tool": "tool_name",',
    '      "parameters": {},',
    '      "explanation": "string",',
    '      "dependsOn": [1]',
    "    }",
    "  ]",
    "}",
    "</output_contract>",
    "",
    "<few_shot_examples>",
    "Example 1: executable single-step plan",
    "{",
    '  "decisionSummary": "The request includes a policy id, so one coverage lookup is sufficient.",',
    '  "requiresClarification": false,',
    '  "clarificationQuestion": null,',
    '  "assumptions": [],',
    '  "missingInputs": [],',
    '  "steps": [',
    "    {",
    '      "step": 1,',
    '      "tool": "policy.coverage.get",',
    '      "parameters": { "policyId": "POL-AUTO-1001" },',
    '      "explanation": "Retrieve deterministic coverage details for the provided policy id."',
    "    }",
    "  ]",
    "}",
    "",
    "Example 2: clarification required",
    "{",
    '  "decisionSummary": "The request asks for coverage but does not include a policy id.",',
    '  "requiresClarification": true,',
    '  "clarificationQuestion": "Which policy id should I use?",',
    '  "assumptions": [],',
    '  "missingInputs": ["policyId"],',
    '  "steps": []',
    "}",
    "",
    "Example 3: executable multi-step plan with dependency",
    "{",
    '  "decisionSummary": "The request includes a customer id and asks for related policy coverage, so customer lookup must precede coverage lookup.",',
    '  "requiresClarification": false,',
    '  "clarificationQuestion": null,',
    '  "assumptions": [],',
    '  "missingInputs": [],',
    '  "steps": [',
    "    {",
    '      "step": 1,',
    '      "tool": "customer.lookup",',
    '      "parameters": { "customerId": "CUST-001" },',
    '      "explanation": "Retrieve the customer record for the provided customer id."',
    "    },",
    "    {",
    '      "step": 2,',
    '      "tool": "policy.coverage.get",',
    '      "parameters": { "policyId": "POL-AUTO-1001" },',
    '      "explanation": "Retrieve coverage details after the customer context is available.",',
    '      "dependsOn": [1]',
    "    }",
    "  ]",
    "}",
    "</few_shot_examples>",
    "",
    "<private_final_self_check>",
    "Before returning, privately verify:",
    "- every tool exists in <available_tools>",
    "- every parameter is supported by the selected tool schema",
    "- no required parameter is missing",
    "- step numbers are sequential",
    "- dependsOn references only prior steps",
    "- clarification responses contain no steps",
    "- executable responses contain at least one step",
    "- output is valid JSON matching <output_contract>",
    "</private_final_self_check>",
    "",
    "<available_tools>",
    renderAvailableTools(input.availableTools),
    "</available_tools>",
  ].join("\n");

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content:
        "Analyze this user request and return only the deterministic planner JSON contract:\n\n" +
        input.userRequest.trim() +
        boundedContext,
    },
  ];
}

export const deterministicPlannerPromptContractV1_1: VersionedPromptContract<
  PlannerPromptOutput,
  PlannerPromptInput
> = {
  id: PLANNER_PROMPT_ID,
  version: PLANNER_PROMPT_VERSION_V1_1,
  purpose:
    "Create deterministic executable plans with strong tool boundaries, clarification policy, examples, and private self-check instructions.",
  inputVariables: [
    {
      name: "userRequest",
      description: "The user's requested goal.",
      required: true,
    },
    {
      name: "availableTools",
      description: "Allowed tools with descriptions and parameter schemas.",
      required: true,
    },
    {
      name: "context",
      description: "Optional bounded context for planning.",
      required: false,
    },
    {
      name: "maxSteps",
      description: "Optional maximum number of plan steps.",
      required: false,
    },
  ],
  outputSchemaName: PLANNER_PROMPT_SCHEMA_NAME_V1_1,
  render: renderDeterministicPlannerPromptV1_1,
  validateOutput: validatePlannerPromptOutput,
};