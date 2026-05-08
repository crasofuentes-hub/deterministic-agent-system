import {
  validatePlannerPromptOutput,
  type PlannerPromptOutput,
  type PlannerStep,
  type PlannerToolDefinition,
} from "../prompts";

export type DeterministicPlanVerificationIssueCode =
  | "PLAN_SCHEMA_INVALID"
  | "PLAN_REQUIRES_CLARIFICATION"
  | "PLAN_TOOL_NOT_ALLOWED"
  | "PLAN_TOOL_PARAMETERS_INVALID"
  | "PLAN_DEPENDENCY_INVALID";

export interface DeterministicPlanVerificationIssue {
  readonly code: DeterministicPlanVerificationIssueCode;
  readonly message: string;
  readonly path: string;
}

export interface DeterministicPlanVerificationContext {
  readonly availableTools: readonly PlannerToolDefinition[];
  readonly maxSteps?: number;
  readonly requireExecutablePlan?: boolean;
}

export interface DeterministicPlanVerificationSuccess {
  readonly ok: true;
  readonly executable: boolean;
  readonly plan: PlannerPromptOutput;
  readonly normalizedToolNames: readonly string[];
}

export interface DeterministicPlanVerificationFailure {
  readonly ok: false;
  readonly executable: false;
  readonly issues: readonly DeterministicPlanVerificationIssue[];
}

export type DeterministicPlanVerificationResult =
  | DeterministicPlanVerificationSuccess
  | DeterministicPlanVerificationFailure;

type JsonSchemaRecord = Record<string, unknown>;

function issue(
  code: DeterministicPlanVerificationIssueCode,
  message: string,
  path: string,
): DeterministicPlanVerificationIssue {
  return {
    code,
    message,
    path,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readSchemaType(schema: JsonSchemaRecord): string | undefined {
  const type = schema.type;

  return typeof type === "string" ? type : undefined;
}

function readRequiredKeys(schema: JsonSchemaRecord): readonly string[] {
  const required = schema.required;

  if (!Array.isArray(required)) {
    return [];
  }

  return required.filter((item): item is string => typeof item === "string");
}

function readProperties(schema: JsonSchemaRecord): Record<string, JsonSchemaRecord> {
  const properties = schema.properties;

  if (!isPlainRecord(properties)) {
    return {};
  }

  const normalized: Record<string, JsonSchemaRecord> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isPlainRecord(value)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function validatePrimitiveType(
  value: unknown,
  expectedType: string,
): boolean {
  if (expectedType === "string") return typeof value === "string";
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "integer") return Number.isSafeInteger(value);
  if (expectedType === "boolean") return typeof value === "boolean";
  if (expectedType === "object") return isPlainRecord(value);
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "null") return value === null;

  return true;
}

function validateEnum(value: unknown, schema: JsonSchemaRecord): boolean {
  const enumValues = schema.enum;

  if (!Array.isArray(enumValues)) {
    return true;
  }

  return enumValues.some((allowed) => Object.is(allowed, value));
}

function validateParameterSchema(
  value: unknown,
  schema: JsonSchemaRecord,
  path: string,
): readonly DeterministicPlanVerificationIssue[] {
  const issues: DeterministicPlanVerificationIssue[] = [];
  const expectedType = readSchemaType(schema);

  if (typeof expectedType === "string" && !validatePrimitiveType(value, expectedType)) {
    issues.push(
      issue(
        "PLAN_TOOL_PARAMETERS_INVALID",
        "Expected " + expectedType + " parameter value",
        path,
      ),
    );

    return issues;
  }

  if (!validateEnum(value, schema)) {
    issues.push(
      issue(
        "PLAN_TOOL_PARAMETERS_INVALID",
        "Parameter value is not one of the allowed enum values",
        path,
      ),
    );

    return issues;
  }

  if (expectedType === "object" || isPlainRecord(value)) {
    if (!isPlainRecord(value)) {
      return issues;
    }

    const requiredKeys = readRequiredKeys(schema);
    const properties = readProperties(schema);

    for (const requiredKey of requiredKeys) {
      if (!(requiredKey in value)) {
        issues.push(
          issue(
            "PLAN_TOOL_PARAMETERS_INVALID",
            "Missing required tool parameter: " + requiredKey,
            path + "." + requiredKey,
          ),
        );
      }
    }

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (propertyName in value) {
        issues.push(
          ...validateParameterSchema(
            value[propertyName],
            propertySchema,
            path + "." + propertyName,
          ),
        );
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(properties));
      const unknownKey = Object.keys(value)
        .sort()
        .find((key) => !allowedKeys.has(key));

      if (typeof unknownKey === "string") {
        issues.push(
          issue(
            "PLAN_TOOL_PARAMETERS_INVALID",
            "Unknown tool parameter: " + unknownKey,
            path + "." + unknownKey,
          ),
        );
      }
    }
  }

  return issues;
}

function buildToolMap(
  availableTools: readonly PlannerToolDefinition[],
): Map<string, PlannerToolDefinition> {
  const toolMap = new Map<string, PlannerToolDefinition>();

  for (const tool of availableTools) {
    const name = readNonEmptyString(tool.name);

    if (typeof name !== "string") {
      continue;
    }

    toolMap.set(name, tool);
  }

  return toolMap;
}

function verifyStepDependencies(step: PlannerStep, index: number): readonly DeterministicPlanVerificationIssue[] {
  const issues: DeterministicPlanVerificationIssue[] = [];

  if (typeof step.dependsOn === "undefined") {
    return issues;
  }

  const seen = new Set<number>();

  for (const dependency of step.dependsOn) {
    if (!Number.isSafeInteger(dependency) || dependency <= 0 || dependency >= step.step) {
      issues.push(
        issue(
          "PLAN_DEPENDENCY_INVALID",
          "dependsOn entries must reference prior step numbers",
          "$.steps[" + index + "].dependsOn",
        ),
      );
      continue;
    }

    if (seen.has(dependency)) {
      issues.push(
        issue(
          "PLAN_DEPENDENCY_INVALID",
          "dependsOn entries must not contain duplicates",
          "$.steps[" + index + "].dependsOn",
        ),
      );
      continue;
    }

    seen.add(dependency);
  }

  return issues;
}

export function verifyDeterministicPlan(
  plannerOutput: unknown,
  context: DeterministicPlanVerificationContext,
): DeterministicPlanVerificationResult {
  const toolMap = buildToolMap(context.availableTools);
  const normalizedToolNames = [...toolMap.keys()].sort();

  const schemaValidation = validatePlannerPromptOutput(plannerOutput, {
    allowedToolNames: normalizedToolNames,
    maxSteps: context.maxSteps,
  });

  if (!schemaValidation.ok) {
    return {
      ok: false,
      executable: false,
      issues: [
        issue(
          "PLAN_SCHEMA_INVALID",
          schemaValidation.error.message,
          schemaValidation.error.path ?? "$",
        ),
      ],
    };
  }

  const plan = schemaValidation.value;
  const issues: DeterministicPlanVerificationIssue[] = [];

  if (context.requireExecutablePlan === true && plan.requiresClarification) {
    issues.push(
      issue(
        "PLAN_REQUIRES_CLARIFICATION",
        "Plan requires clarification and is not executable",
        "$.requiresClarification",
      ),
    );
  }

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const path = "$.steps[" + index + "]";
    const tool = toolMap.get(step.tool);

    if (!tool) {
      issues.push(
        issue(
          "PLAN_TOOL_NOT_ALLOWED",
          "Tool is not declared in available tools: " + step.tool,
          path + ".tool",
        ),
      );
      continue;
    }

    issues.push(...verifyStepDependencies(step, index));

    issues.push(
      ...validateParameterSchema(
        step.parameters,
        tool.parametersSchema,
        path + ".parameters",
      ),
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      executable: false,
      issues,
    };
  }

  return {
    ok: true,
    executable: !plan.requiresClarification,
    plan,
    normalizedToolNames,
  };
}