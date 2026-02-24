import type { DeterministicAgentPlan, AgentStep } from "./plan-types";

export interface PolicyValidationIssue {
  code: string;
  message: string;
}

export interface PolicyValidationResult {
  ok: boolean;
  issues: PolicyValidationIssue[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStep(step: AgentStep, index: number): PolicyValidationIssue[] {
  const issues: PolicyValidationIssue[] = [];

  if (!isNonEmptyString(step.id)) {
    issues.push({
      code: "INVALID_STEP_ID",
      message: "Step at index " + index + " requires a non-empty id",
    });
  }

  if (step.kind === "set") {
    if (!isNonEmptyString(step.key)) {
      issues.push({
        code: "INVALID_STEP_KEY",
        message: "Step '" + step.id + "' (set) requires non-empty key",
      });
    }
    if (typeof step.value !== "string") {
      issues.push({
        code: "INVALID_STEP_VALUE",
        message: "Step '" + step.id + "' (set) requires string value",
      });
    }
  }

  if (step.kind === "increment") {
    if (!isNonEmptyString(step.key)) {
      issues.push({
        code: "INVALID_STEP_KEY",
        message: "Step '" + step.id + "' (increment) requires non-empty key",
      });
    }
    if (typeof step.value !== "number" || !Number.isInteger(step.value)) {
      issues.push({
        code: "INVALID_STEP_VALUE",
        message: "Step '" + step.id + "' (increment) requires integer value",
      });
    }
  }

  if (step.kind === "append_log") {
    if (typeof step.value !== "string") {
      issues.push({
        code: "INVALID_STEP_VALUE",
        message: "Step '" + step.id + "' (append_log) requires string value",
      });
    }
  }

  return issues;
}

export function validatePlan(plan: DeterministicAgentPlan): PolicyValidationResult {
  const issues: PolicyValidationIssue[] = [];

  if (!isNonEmptyString(plan.planId)) {
    issues.push({ code: "INVALID_PLAN_ID", message: "planId must be a non-empty string" });
  }

  if (plan.version !== 1) {
    issues.push({ code: "UNSUPPORTED_PLAN_VERSION", message: "Only plan version 1 is supported" });
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    issues.push({ code: "EMPTY_PLAN", message: "Plan must contain at least one step" });
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (!step) {
      issues.push({
        code: "UNDEFINED_STEP",
        message: "Step at index " + i + " is undefined",
      });
      continue;
    }

    const stepIssues = validateStep(step, i);
    issues.push(...stepIssues);

    if (isNonEmptyString(step.id)) {
      if (seenIds.has(step.id)) {
        issues.push({
          code: "DUPLICATE_STEP_ID",
          message: "Duplicate step id: " + step.id,
        });
      }
      seenIds.add(step.id);
    }
  }

  return { ok: issues.length === 0, issues };
}