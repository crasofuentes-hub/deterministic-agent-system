import type { AgentExecutionResult, DeterministicAgentPlan } from "./plan-types";
import { executeDeterministicPlan } from "./executor";

export interface ReplayVerificationSuccess {
  ok: true;
  checks: {
    planHashMatch: true;
    executionHashMatch: true;
    finalTraceLinkHashMatch: true;
    finalStateMatch: true;
    traceLengthMatch: true;
    traceSchemaVersionMatch: true;
  };
}

export interface ReplayVerificationFail {
  ok: false;
  reason: string;
}

export type ReplayVerificationResult = ReplayVerificationSuccess | ReplayVerificationFail;

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function verifyExecutionReplay(params: {
  plan: DeterministicAgentPlan;
  recorded: AgentExecutionResult;
}): ReplayVerificationResult {
  const rerun = executeDeterministicPlan(params.plan, {
    mode: "mock",
    maxSteps: Math.max(1, params.recorded.stepsRequested + 10),
  });

  if (!rerun.ok) {
    return {
      ok: false,
      reason: "Replay execution failed: " + rerun.error.code + " / " + rerun.error.message,
    };
  }

  const result = rerun.result;

  if (result.traceSchemaVersion !== params.recorded.traceSchemaVersion) {
    return { ok: false, reason: "traceSchemaVersion mismatch" };
  }
  if (result.planHash !== params.recorded.planHash) {
    return { ok: false, reason: "planHash mismatch" };
  }
  if (result.executionHash !== params.recorded.executionHash) {
    return { ok: false, reason: "executionHash mismatch" };
  }
  if (result.finalTraceLinkHash !== params.recorded.finalTraceLinkHash) {
    return { ok: false, reason: "finalTraceLinkHash mismatch" };
  }
  if (result.trace.length !== params.recorded.trace.length) {
    return { ok: false, reason: "trace length mismatch" };
  }
  if (stableJson(result.finalState) !== stableJson(params.recorded.finalState)) {
    return { ok: false, reason: "finalState mismatch" };
  }

  return {
    ok: true,
    checks: {
      planHashMatch: true,
      executionHashMatch: true,
      finalTraceLinkHashMatch: true,
      finalStateMatch: true,
      traceLengthMatch: true,
      traceSchemaVersionMatch: true,
    },
  };
}