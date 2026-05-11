import { canonicalizePlan } from "../agent/canonical-plan";
import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { PlannerPromptOutput, PlannerStep } from "../prompts";
import {
  assertVerifiedLlmLivePlannerPromptText,
  type VerifiedLlmLivePlannerPromptInput,
} from "./llm-live-planner-contract";

export interface BridgeVerifiedPlannerOutputToAgentPlanInput {
  readonly planId: string;
  readonly plannerOutput: PlannerPromptOutput;
  readonly stepIdPrefix?: string;
  readonly outputKeyPrefix?: string;
}

export interface BridgeVerifiedLlmLivePlannerPromptTextToAgentPlanInput
  extends Omit<VerifiedLlmLivePlannerPromptInput, "requireExecutablePlan"> {
  readonly planId: string;
  readonly stepIdPrefix?: string;
  readonly outputKeyPrefix?: string;
}

function readNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return value.trim();
}

function buildPaddedStepNumber(stepNumber: number): string {
  return String(stepNumber).padStart(4, "0");
}

function buildBridgeStepId(step: PlannerStep, prefix: string): string {
  return prefix + "_" + buildPaddedStepNumber(step.step);
}

function buildOutputKey(step: PlannerStep, prefix: string): string {
  return prefix + "_" + String(step.step);
}

export function bridgeVerifiedPlannerOutputToAgentPlan(
  input: BridgeVerifiedPlannerOutputToAgentPlanInput,
): DeterministicAgentPlan {
  const planId = readNonEmptyString(input.planId, "planId");
  const stepIdPrefix = readNonEmptyString(input.stepIdPrefix ?? "tool", "stepIdPrefix");
  const outputKeyPrefix = readNonEmptyString(input.outputKeyPrefix ?? "step", "outputKeyPrefix");

  if (input.plannerOutput.requiresClarification) {
    throw new Error("llm_live_planner_bridge_requires_executable_plan: planner output requires clarification");
  }

  if (input.plannerOutput.steps.length === 0) {
    throw new Error("llm_live_planner_bridge_empty_steps: executable planner output must contain steps");
  }

  const plan: DeterministicAgentPlan = {
    planId,
    version: 1,
    steps: input.plannerOutput.steps.map((step) => ({
      id: buildBridgeStepId(step, stepIdPrefix),
      kind: "tool.call",
      toolId: step.tool,
      input: step.parameters,
      outputKey: buildOutputKey(step, outputKeyPrefix),
    })),
  };

  return canonicalizePlan(plan);
}

export function bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan(
  input: BridgeVerifiedLlmLivePlannerPromptTextToAgentPlanInput,
): DeterministicAgentPlan {
  const verified = assertVerifiedLlmLivePlannerPromptText({
    text: input.text,
    availableTools: input.availableTools,
    maxSteps: input.maxSteps,
    requireExecutablePlan: true,
  });

  return bridgeVerifiedPlannerOutputToAgentPlan({
    planId: input.planId,
    plannerOutput: verified.plannerOutput,
    stepIdPrefix: input.stepIdPrefix,
    outputKeyPrefix: input.outputKeyPrefix,
  });
}