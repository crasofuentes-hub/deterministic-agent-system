import { verifyDeterministicPlan, type DeterministicPlanVerificationIssue } from "../planner";
import {
  deterministicPlannerPromptContract,
  type PlannerPromptOutput,
  type PlannerToolDefinition,
} from "../prompts";

export interface VerifiedLlmLivePlannerPromptInput {
  readonly text: string;
  readonly availableTools: readonly PlannerToolDefinition[];
  readonly maxSteps?: number;
  readonly requireExecutablePlan?: boolean;
}

export interface VerifiedLlmLivePlannerPromptSuccess {
  readonly ok: true;
  readonly plannerOutput: PlannerPromptOutput;
  readonly executable: boolean;
  readonly normalizedToolNames: readonly string[];
}

export interface VerifiedLlmLivePlannerPromptFailure {
  readonly ok: false;
  readonly error: {
    readonly code: "LLM_LIVE_PLANNER_CONTRACT_INVALID";
    readonly message: string;
    readonly retryable: false;
    readonly issues: readonly DeterministicPlanVerificationIssue[];
  };
}

export type VerifiedLlmLivePlannerPromptResult =
  | VerifiedLlmLivePlannerPromptSuccess
  | VerifiedLlmLivePlannerPromptFailure;

function invalidPlannerContract(
  message: string,
  issues: readonly DeterministicPlanVerificationIssue[],
): VerifiedLlmLivePlannerPromptFailure {
  return {
    ok: false,
    error: {
      code: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
      message,
      retryable: false,
      issues,
    },
  };
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(String(text ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error("llm_live_planner_contract_invalid_json: " + message);
  }
}

export function verifyLlmLivePlannerPromptText(
  input: VerifiedLlmLivePlannerPromptInput,
): VerifiedLlmLivePlannerPromptResult {
  let parsed: unknown;

  try {
    parsed = parseJsonObject(input.text);
  } catch (error) {
    return invalidPlannerContract(error instanceof Error ? error.message : String(error), [
      {
        code: "PLAN_SCHEMA_INVALID",
        message: error instanceof Error ? error.message : String(error),
        path: "$",
      },
    ]);
  }

  const promptValidation = deterministicPlannerPromptContract.validateOutput(parsed);

  if (!promptValidation.ok) {
    return invalidPlannerContract(promptValidation.error.message, [
      {
        code: "PLAN_SCHEMA_INVALID",
        message: promptValidation.error.message,
        path: promptValidation.error.path ?? "$",
      },
    ]);
  }

  const verification = verifyDeterministicPlan(promptValidation.value, {
    availableTools: input.availableTools,
    maxSteps: input.maxSteps,
    requireExecutablePlan: input.requireExecutablePlan,
  });

  if (!verification.ok) {
    return invalidPlannerContract("Planner output failed deterministic verification", verification.issues);
  }

  return {
    ok: true,
    plannerOutput: verification.plan,
    executable: verification.executable,
    normalizedToolNames: verification.normalizedToolNames,
  };
}

export function assertVerifiedLlmLivePlannerPromptText(
  input: VerifiedLlmLivePlannerPromptInput,
): VerifiedLlmLivePlannerPromptSuccess {
  const result = verifyLlmLivePlannerPromptText(input);

  if (!result.ok) {
    throw new Error(
      result.error.code +
        ": " +
        result.error.message +
        " issues=" +
        JSON.stringify(result.error.issues),
    );
  }

  return result;
}