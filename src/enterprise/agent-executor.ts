import { executeDeterministicPlan } from "../agent";
import type { ExecuteRequest } from "../http/request-types";

export type FixpointFinalStatus = "completed" | "failed" | "terminal";

export interface FixpointOutcome {
  status: FixpointFinalStatus;
  iterationsUsed: number;
  backoffScheduleMs: number[];
  lastErrorCode?: string;
  lastErrorMessage?: string;
  execution?: unknown;
}

function isRetryableErrorCode(code: string): boolean {
  // Reglas deterministas (enterprise):
  // - timeouts/red/overload se consideran retryables
  // - convergencia fallida NO retryable (normalmente es terminal)
  return (
    code === "NETWORK_ERROR" ||
    code === "TIMEOUT" ||
    code === "OVERLOADED" ||
    code === "INTERNAL_ERROR"
  );
}

function backoffMs(attempt: number, baseMs: number, capMs: number): number {
  // backoff determinista: base * 2^attempt, cap
  const raw = baseMs * Math.pow(2, attempt);
  return raw > capMs ? capMs : raw;
}

export function executeWithFixpoint(
  request: ExecuteRequest,
  params?: {
    maxIterations?: number; // default 20
    baseBackoffMs?: number; // default 25
    maxBackoffMs?: number; // default 1000
  }
): FixpointOutcome {
  const maxIterations = params?.maxIterations ?? 20;
  const baseBackoffMs = params?.baseBackoffMs ?? 25;
  const maxBackoffMs = params?.maxBackoffMs ?? 1000;

  const schedule: number[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    const result = executeDeterministicPlan(request.plan, {
      mode: request.mode,
      maxSteps: request.maxSteps,
      traceId: request.traceId,
    });

    if (result.ok) {
      return {
        status: "completed",
        iterationsUsed: iter + 1,
        backoffScheduleMs: schedule,
        execution: result,
      };
    }

    const code = result.error.code;
    const msg = result.error.message;

    if (!isRetryableErrorCode(code)) {
      return {
        status: code === "EXECUTION_CONVERGENCE_FAILED" ? "terminal" : "failed",
        iterationsUsed: iter + 1,
        backoffScheduleMs: schedule,
        lastErrorCode: code,
        lastErrorMessage: msg,
      };
    }

    // Determinista: registramos el backoff (no dormimos aquí)
    schedule.push(backoffMs(iter, baseBackoffMs, maxBackoffMs));
    // loop continues -> retry
  }

  return {
    status: "terminal",
    iterationsUsed: maxIterations,
    backoffScheduleMs: schedule,
    lastErrorCode: "FIXPOINT_MAX_ITER",
    lastErrorMessage: "Fixpoint did not converge within max iterations",
  };
}
