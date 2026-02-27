import { ERROR_CODES } from "../core/error-codes";
import { failure, success, type DeterministicResponse, type ExecutionMode } from "../core/contracts";
import type { DeterministicAgentPlan, AgentExecutionResult, StepTrace, AgentState, AgentStep } from "./plan-types";
import { validatePlan } from "./policies";
import { applyMockStep, createInitialAgentState, getStateHashLike } from "./mock-adapter";
import { canonicalizePlan } from "./canonical-plan";
import { computeDeterministicPlanHash } from "./plan-hash";
import { computeTraceLinkHash, computeExecutionHash, TRACE_SCHEMA_VERSION } from "./trace-chain";
import type { SandboxFactory, SandboxSession } from "../enterprise/sandbox-utils";
import { PlaywrightSandbox } from "../enterprise/playwright-sandbox";

export interface ExecutePlanOptionsAsync {
  mode: ExecutionMode; // "local" | "mock"
  maxSteps: number;
  traceId?: string;
}

export interface ExecutorAsyncDeps {
  sandboxFactory?: SandboxFactory;
}

function isSandboxKind(kind: string): boolean {
  return kind.startsWith("sandbox.");
}

async function applySandboxStepLocal(
  state: AgentState,
  step: AgentStep,
  sessions: Map<string, SandboxSession>,
  factory: SandboxFactory
): Promise<AgentState> {
  const next: AgentState = {
    counters: { ...state.counters },
    values: { ...state.values },
    logs: state.logs.slice(),
  };

  const sessionId = String(step.sessionId ?? "");
  if (!sessionId) {
    throw new Error("sandbox step missing sessionId");
  }

  let session = sessions.get(sessionId);
  if (!session) {
    session = factory.create({ sessionId });
    sessions.set(sessionId, session);
  }

  if (step.kind === "sandbox.open") {
    const url = String(step.url ?? "");
    const r = await session.open(url);
    if (!r.ok) throw new Error(`sandbox.open failed: ${r.error.code}: ${r.error.message}`);
    next.logs.push(`sandbox.open:${sessionId}:${url}`);
    return next;
  }

  if (step.kind === "sandbox.click") {
    const selector = String(step.selector ?? "");
    const r = await session.click(selector);
    if (!r.ok) throw new Error(`sandbox.click failed: ${r.error.code}: ${r.error.message}`);
    next.logs.push(`sandbox.click:${sessionId}:${selector}`);
    return next;
  }

  if (step.kind === "sandbox.type") {
    const selector = String(step.selector ?? "");
    const text = String(step.text ?? "");
    const r = await session.type(selector, text);
    if (!r.ok) throw new Error(`sandbox.type failed: ${r.error.code}: ${r.error.message}`);
    next.logs.push(`sandbox.type:${sessionId}:${selector}:len=${text.length}`);
    return next;
  }

  // sandbox.extract
  const selector = String(step.selector ?? "");
  const outputKey = String(step.outputKey ?? "");
  const r = await session.extract(selector);
  if (!r.ok) throw new Error(`sandbox.extract failed: ${r.error.code}: ${r.error.message}`);
  next.values[outputKey] = (r.value.text ?? "").normalize("NFC");
  next.logs.push(`sandbox.extract:${sessionId}:${selector}:out=${outputKey}`);
  return next;
}


function logStepEnd(params: {
  traceId?: string;
  planId: string;
  stepIndex: number;
  stepId: string;
  kind: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}): void {
  if (!params.traceId) return;
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    subsystem: "agent",
    event: "step.end",
    traceId: params.traceId,
    planId: params.planId,
    stepIndex: params.stepIndex,
    stepId: params.stepId,
    kind: params.kind,
    durationMs: params.durationMs,
    ok: params.ok,
  };
  if (!params.ok) {
    payload.errorCode = params.errorCode ?? "INTERNAL_ERROR";
    payload.errorMessage = params.errorMessage ?? "step failed";
  }
  console.log(JSON.stringify(payload));
}

export async function executeDeterministicPlanAsync(
  plan: DeterministicAgentPlan,
  options: ExecutePlanOptionsAsync,
  deps: ExecutorAsyncDeps = {}
): Promise<DeterministicResponse<AgentExecutionResult>> {
  if (!Number.isInteger(options.maxSteps) || options.maxSteps <= 0) {
    return failure(
      {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "maxSteps must be a positive integer",
        retryable: false,
      },
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
      {
        code: ERROR_CODES.EXECUTION_CONVERGENCE_FAILED,
        message: "Plan exceeds maxSteps bound",
        retryable: false,
      },
      { mode: options.mode, stepCount: 0, traceId: options.traceId }
    );
  }

  let state = createInitialAgentState();
  const trace: StepTrace[] = [];
  let previousTraceLinkHash = "tl" + "0".repeat(64);

  const sandboxFactory: SandboxFactory =
    deps.sandboxFactory ??
    (options.mode === "local" ? new PlaywrightSandbox({ headless: true }) : (undefined as any));

  const sessions = new Map<string, SandboxSession>();

  try {
    for (let i = 0; i < canonicalPlan.steps.length; i += 1) {
      const step = canonicalPlan.steps[i];
      const stepStartedAt = Date.now();
      if (!step) {
        return failure(
          {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: "Undefined step encountered after validation",
            retryable: false,
          },
          { mode: options.mode, stepCount: i, traceId: options.traceId }
        );
      }

      const beforeState = {
        counters: { ...state.counters },
        values: { ...state.values },
        logs: state.logs.slice(),
      };
      const beforeHashLike = getStateHashLike(beforeState);

      let nextState: AgentState;
      try {
        if (options.mode === "local" && isSandboxKind(step.kind)) {
          nextState = await applySandboxStepLocal(state, step, sessions, sandboxFactory);
        } else {
          nextState = applyMockStep(state, step);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logStepEnd({
          traceId: options.traceId,
          planId: canonicalPlan.planId,
          stepIndex: i,
          stepId: step.id,
          kind: step.kind,
          durationMs: Date.now() - stepStartedAt,
          ok: false,
          errorCode: "INTERNAL_ERROR",
          errorMessage: msg,
        });
        return failure(
          { code: ERROR_CODES.INTERNAL_ERROR, message: msg, retryable: true },
          { mode: options.mode, stepCount: i, traceId: options.traceId }
        );
      }

      const afterState = {
        counters: { ...nextState.counters },
        values: { ...nextState.values },
        logs: nextState.logs.slice(),
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
      logStepEnd({
        traceId: options.traceId,
        planId: canonicalPlan.planId,
        stepIndex: i,
        stepId: step.id,
        kind: step.kind,
        durationMs: Date.now() - stepStartedAt,
        ok: true,
      });
      state = nextState;
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
      { mode: options.mode, stepCount: canonicalPlan.steps.length, traceId: options.traceId }
    );
  } finally {
    for (const s of sessions.values()) {
      try {
        await s.close();
      } catch {
        /* ignore */
      }
    }

    const maybe = sandboxFactory as any;
    if (typeof maybe.shutdown === "function") {
      try {
        await maybe.shutdown();
      } catch {
        /* ignore */
      }
    }
  }
}
