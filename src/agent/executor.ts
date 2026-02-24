import { ERROR_CODES } from "../core/error-codes";
import { failure, success, type DeterministicResponse, type ExecutionMode } from "../core/contracts";
import type { DeterministicAgentPlan, AgentExecutionResult, StepTrace } from "./plan-types";
import { validatePlan } from "./policies";
import { applyMockStep, createInitialAgentState, getStateHashLike } from "./mock-adapter";
import { canonicalizePlan } from "./canonical-plan";
import { computeDeterministicPlanHash } from "./plan-hash";
import { computeTraceLinkHash, computeExecutionHash, TRACE_SCHEMA_VERSION } from "./trace-chain";

export interface ExecutePlanOptions {
  mode: ExecutionMode;
  maxSteps: number;
  traceId?: string;
}

export function executeDeterministicPlan(
  plan: DeterministicAgentPlan,
  options: ExecutePlanOptions
): DeterministicResponse<AgentExecutionResult> {
  if (!Number.isInteger(options.maxSteps) || options.maxSteps <= 0) {
    return failure(
      { code: ERROR_CODES.INVALID_REQUEST, message: "maxSteps must be a positive integer", retryable: false },
      { mode: options.mode, traceId: options.traceId }
    );
  }

  const validation = validatePlan(plan);
  if (!validation.ok) {
    return failure(
      {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "Plan validation failed: " + validation.issues.map((x) => x.code).join(", "),
        retryable: false,
      },
      { mode: options.mode, traceId: options.traceId }
    );
  }

  let canonicalPlan: DeterministicAgentPlan;
  try {
    canonicalPlan = canonicalizePlan(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure(
      {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "Plan canonicalization failed: " + message,
        retryable: false,
      },
      { mode: options.mode, traceId: options.traceId }
    );
  }

  const planHash = computeDeterministicPlanHash(canonicalPlan);

  if (canonicalPlan.steps.length > options.maxSteps) {
    return failure(
      { code: ERROR_CODES.EXECUTION_CONVERGENCE_FAILED, message: "Plan exceeds maxSteps bound", retryable: false },
      { mode: options.mode, stepCount: 0, traceId: options.traceId }
    );
  }

  let state = createInitialAgentState();
  const trace: StepTrace[] = [];
  let previousTraceLinkHash = "tl" + "0".repeat(64);

  for (let i = 0; i < canonicalPlan.steps.length; i += 1) {
    const step = canonicalPlan.steps[i];
    if (!step) {
      return failure(
        { code: ERROR_CODES.INTERNAL_ERROR, message: "Undefined step encountered after validation", retryable: false },
        { mode: options.mode, stepCount: i, traceId: options.traceId }
      );
    }

    const beforeState = {
      counters: { ...state.counters },
      values: { ...state.values },
      logs: state.logs.slice(),
    };
    const beforeHashLike = getStateHashLike(beforeState);

    const next = applyMockStep(state, step);

    const afterState = {
      counters: { ...next.counters },
      values: { ...next.values },
      logs: next.logs.slice(),
    };
    const afterHashLike = getStateHashLike(afterState);

    const traceLinkHash = computeTraceLinkHash({
      previousLinkHash: previousTraceLinkHash,
      stepIndex: i,
      step,
      beforeHashLike,
      afterHashLike,
      beforeState,
      afterState,
    });

    trace.push({
      traceSchemaVersion: TRACE_SCHEMA_VERSION,
      stepIndex: i,
      stepId: step.id,
      kind: step.kind,
      beforeHashLike,
      afterHashLike,
      previousTraceLinkHash,
      traceLinkHash,
      applied: true,
    });

    previousTraceLinkHash = traceLinkHash;
    state = next;
  }

  const finalTraceLinkHash = previousTraceLinkHash;
  const executionHash = computeExecutionHash({
    planHash,
    stepCount: canonicalPlan.steps.length,
    finalState: state,
    finalTraceLinkHash,
  });

  return success(
    {
      planId: canonicalPlan.planId,
      planHash,
      executionHash,
      finalTraceLinkHash,
      traceSchemaVersion: TRACE_SCHEMA_VERSION,
      stepsRequested: canonicalPlan.steps.length,
      stepsExecuted: canonicalPlan.steps.length,
      converged: true,
      finalState: state,
      trace,
    },
    {
      mode: options.mode,
      stepCount: canonicalPlan.steps.length,
      traceId: options.traceId,
    }
  );
}