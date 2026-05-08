import {
  failPromptValidation,
  isPlainRecord,
  passPromptValidation,
  type PromptMessage,
  type PromptValidationResult,
  type VersionedPromptContract,
} from "../contracts";

export const PLANNER_PROMPT_ID = "planner.deterministic";
export const PLANNER_PROMPT_VERSION = "1.0.0";
export const PLANNER_PROMPT_SCHEMA_NAME = "DeterministicPlannerOutputV1";

export interface PlannerToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parametersSchema: Record<string, unknown>;
}

export interface PlannerPromptInput extends Record<string, unknown> {
  readonly userRequest: string;
  readonly availableTools: readonly PlannerToolDefinition[];
  readonly context?: string;
  readonly maxSteps?: number;
}

export interface PlannerStep {
  readonly step: number;
  readonly tool: string;
  readonly parameters: Record<string, unknown>;
  readonly explanation: string;
  readonly dependsOn?: readonly number[];
}

export interface PlannerPromptOutput {
  readonly decisionSummary: string;
  readonly requiresClarification: boolean;
  readonly clarificationQuestion: string | null;
  readonly assumptions: readonly string[];
  readonly missingInputs: readonly string[];
  readonly steps: readonly PlannerStep[];
}

export interface PlannerOutputValidationOptions {
  readonly allowedToolNames?: readonly string[];
  readonly maxSteps?: number;
}

const TOP_LEVEL_KEYS = new Set([
  "decisionSummary",
  "requiresClarification",
  "clarificationQuestion",
  "assumptions",
  "missingInputs",
  "steps",
]);

const STEP_KEYS = new Set(["step", "tool", "parameters", "explanation", "dependsOn"]);

function readNonEmptyString(value: unknown, path: string): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateNoUnknownKeys(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
): PromptValidationResult<true> {
  const unknownKey = Object.keys(record)
    .sort()
    .find((key) => !allowedKeys.has(key));

  if (typeof unknownKey === "string") {
    return failPromptValidation('Unknown property "' + unknownKey + '" at ' + path, path);
  }

  return passPromptValidation(true);
}

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

function renderPlannerPrompt(input: PlannerPromptInput): readonly PromptMessage[] {
  const userRequest = readNonEmptyString(input.userRequest, "userRequest");

  if (typeof userRequest !== "string") {
    throw new Error("userRequest must be a non-empty string");
  }

  if (!Array.isArray(input.availableTools) || input.availableTools.length === 0) {
    throw new Error("availableTools must be a non-empty array");
  }

  for (const tool of input.availableTools) {
    if (readNonEmptyString(tool.name, "tool.name") !== tool.name.trim()) {
      throw new Error("availableTools[].name must be a non-empty string");
    }

    if (readNonEmptyString(tool.description, "tool.description") !== tool.description.trim()) {
      throw new Error("availableTools[].description must be a non-empty string");
    }

    if (!isPlainRecord(tool.parametersSchema)) {
      throw new Error("availableTools[].parametersSchema must be an object");
    }
  }

  const maxSteps =
    typeof input.maxSteps === "number" && Number.isSafeInteger(input.maxSteps) && input.maxSteps > 0
      ? input.maxSteps
      : 8;

  const optionalContext =
    typeof input.context === "string" && input.context.trim().length > 0
      ? "\n\n<context>\n" + input.context.trim() + "\n</context>"
      : "";

  const systemPrompt = [
    "You are a deterministic planning component.",
    "Your only job is to produce a precise executable plan for the user goal.",
    "",
    "<rules>",
    "- Return JSON only. Do not wrap the response in markdown.",
    "- Do not include hidden reasoning or chain-of-thought.",
    "- Use decisionSummary for a concise operational justification.",
    "- Use only tools listed in <available_tools>.",
    "- Never invent tool names, parameters, or capabilities.",
    "- Each step must be atomic and executable by exactly one tool.",
    "- Step numbers must start at 1 and increment by 1.",
    "- Use dependsOn only for prior step numbers.",
    "- If critical information is missing, set requiresClarification=true, provide clarificationQuestion, and return steps=[].",
    "- If requiresClarification=false, clarificationQuestion must be null.",
    "- Do not exceed " + String(maxSteps) + " steps.",
    "</rules>",
    "",
    "<output_schema>",
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
    "</output_schema>",
    "",
    "<few_shot_examples>",
    "Example A: if the user request lacks a required account id, return requiresClarification=true and no steps.",
    "Example B: if one tool can answer the request, return one atomic step using only that tool.",
    "Example C: if the second step needs output from the first step, use dependsOn with the prior step number.",
    "</few_shot_examples>",
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
      content: "Analyze this user request and return the planner JSON contract:\n\n" + userRequest + optionalContext,
    },
  ];
}

export function validatePlannerPromptOutput(
  output: unknown,
  options: PlannerOutputValidationOptions = {},
): PromptValidationResult<PlannerPromptOutput> {
  if (!isPlainRecord(output)) {
    return failPromptValidation("Planner output must be a JSON object", "$");
  }

  const topKeyValidation = validateNoUnknownKeys(output, TOP_LEVEL_KEYS, "$");
  if (!topKeyValidation.ok) {
    return topKeyValidation;
  }

  const decisionSummary = readNonEmptyString(output.decisionSummary, "$.decisionSummary");
  if (typeof decisionSummary !== "string") {
    return failPromptValidation("decisionSummary must be a non-empty string", "$.decisionSummary");
  }

  if (typeof output.requiresClarification !== "boolean") {
    return failPromptValidation("requiresClarification must be a boolean", "$.requiresClarification");
  }

  if (output.requiresClarification) {
    if (readNonEmptyString(output.clarificationQuestion, "$.clarificationQuestion") === undefined) {
      return failPromptValidation(
        "clarificationQuestion must be a non-empty string when clarification is required",
        "$.clarificationQuestion",
      );
    }
  } else if (output.clarificationQuestion !== null) {
    return failPromptValidation(
      "clarificationQuestion must be null when clarification is not required",
      "$.clarificationQuestion",
    );
  }

  if (!isStringArray(output.assumptions)) {
    return failPromptValidation("assumptions must be an array of strings", "$.assumptions");
  }

  if (!isStringArray(output.missingInputs)) {
    return failPromptValidation("missingInputs must be an array of strings", "$.missingInputs");
  }

  if (!Array.isArray(output.steps)) {
    return failPromptValidation("steps must be an array", "$.steps");
  }

  const maxSteps = options.maxSteps ?? 8;
  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    return failPromptValidation("maxSteps must be a positive integer", "$.maxSteps");
  }

  if (output.steps.length > maxSteps) {
    return failPromptValidation("steps must not exceed maxSteps", "$.steps");
  }

  if (output.requiresClarification && output.steps.length !== 0) {
    return failPromptValidation("steps must be empty when clarification is required", "$.steps");
  }

  if (!output.requiresClarification && output.steps.length === 0) {
    return failPromptValidation("steps must contain at least one step when clarification is not required", "$.steps");
  }

  const allowedToolNames =
    typeof options.allowedToolNames === "undefined" ? undefined : new Set(options.allowedToolNames);

  for (let index = 0; index < output.steps.length; index += 1) {
    const step = output.steps[index];
    const path = "$.steps[" + index + "]";

    if (!isPlainRecord(step)) {
      return failPromptValidation("step must be an object", path);
    }

    const stepKeyValidation = validateNoUnknownKeys(step, STEP_KEYS, path);
    if (!stepKeyValidation.ok) {
      return stepKeyValidation;
    }

    const expectedStepNumber = index + 1;

    if (step.step !== expectedStepNumber) {
      return failPromptValidation("step numbers must start at 1 and increment by 1", path + ".step");
    }

    const tool = readNonEmptyString(step.tool, path + ".tool");
    if (typeof tool !== "string") {
      return failPromptValidation("tool must be a non-empty string", path + ".tool");
    }

    if (allowedToolNames && !allowedToolNames.has(tool)) {
      return failPromptValidation("tool is not declared in available tools: " + tool, path + ".tool");
    }

    if (!isPlainRecord(step.parameters)) {
      return failPromptValidation("parameters must be an object", path + ".parameters");
    }

    if (readNonEmptyString(step.explanation, path + ".explanation") === undefined) {
      return failPromptValidation("explanation must be a non-empty string", path + ".explanation");
    }

    if (typeof step.dependsOn !== "undefined") {
      if (!Array.isArray(step.dependsOn)) {
        return failPromptValidation("dependsOn must be an array when provided", path + ".dependsOn");
      }

      for (const dependency of step.dependsOn) {
        if (!Number.isSafeInteger(dependency) || dependency <= 0 || dependency >= step.step) {
          return failPromptValidation(
            "dependsOn entries must reference prior step numbers",
            path + ".dependsOn",
          );
        }
      }
    }
  }

  return passPromptValidation(output as unknown as PlannerPromptOutput);
}

export const deterministicPlannerPromptContract: VersionedPromptContract<
  PlannerPromptOutput,
  PlannerPromptInput
> = {
  id: PLANNER_PROMPT_ID,
  version: PLANNER_PROMPT_VERSION,
  purpose: "Create deterministic executable plans using only the provided tool surface.",
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
  outputSchemaName: PLANNER_PROMPT_SCHEMA_NAME,
  render: renderPlannerPrompt,
  validateOutput: validatePlannerPromptOutput,
};