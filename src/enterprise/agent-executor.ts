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

function parseFailNTimes(traceId?: string): number {
  if (typeof traceId !== "string") return 0;
  const m = /^FAIL_N_TIMES:(\d+)(?:$|:)/.exec(traceId);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function executeWithFixpoint(
  request: ExecuteRequest,
  params?: {
    onRetry?: (info: { iter: number; backoffMs: number; errorCode: string; errorMessage: string }) => void;
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
    const injectedFails = parseFailNTimes(request.traceId);
    if (injectedFails > 0 && iter < injectedFails) {
      const code = "NETWORK_ERROR";
      const msg = "Injected fault: NETWORK_ERROR";

      schedule.push(backoffMs(iter, baseBackoffMs, maxBackoffMs));
      if (typeof params?.onRetry === "function") {
        params.onRetry({
          iter,
          backoffMs: schedule[schedule.length - 1] ?? 0,
          errorCode: code,
          errorMessage: msg,
        });
      }
      continue;
    }
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
    if (typeof params?.onRetry === "function") {
      params.onRetry({
        iter,
        backoffMs: schedule[schedule.length - 1] ?? 0,
        errorCode: code,
        errorMessage: msg,
      });
    }
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


