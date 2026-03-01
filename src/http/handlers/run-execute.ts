import type { ExecuteRequest } from "../request-types";
import { executeWithFixpoint } from "../../enterprise/agent-executor";
import { getCheckpointStore } from "../../enterprise/state-manager";
import { getAgentRunRegistry } from "../runs/registry";
import type { HttpJsonResult } from "../runs/types";
import { executeDeterministicPlanAsync } from "../../agent/executor-async";
import { PlaywrightSandbox } from "../../enterprise/playwright-sandbox";
import type { DeterministicResponse } from "../../core/contracts";

type UnknownRecord = Record<string, unknown>;

const localPlaywrightSandbox = new PlaywrightSandbox({ headless: true });

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ok(statusCode: number, result: unknown): HttpJsonResult {
  return {
    statusCode,
    body: {
      ok: true,
      result,
    },
  };
}

function badRequest(message: string): HttpJsonResult {
  return {
    statusCode: 400,
    body: {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message,
        retryable: false,
      },
      meta: {},
    },
  };
}

function notFound(message: string): HttpJsonResult {
  return {
    statusCode: 404,
    body: {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message,
        retryable: false,
      },
      meta: {},
    },
  };
}

function conflict(message: string): HttpJsonResult {
  return {
    statusCode: 409,
    body: {
      ok: false,
      error: {
        code: "INVALID_RUN_TRANSITION",
        message,
        retryable: false,
      },
      meta: {},
    },
  };
}

function internalError(): HttpJsonResult {
  return {
    statusCode: 500,
    body: {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        retryable: false,
      },
      meta: {},
    },
  };
}

function mapRegistryError(err: unknown): HttpJsonResult {
  const message = err instanceof Error ? err.message : String(err);

  if (message.startsWith("Run not found:")) {
    return notFound(message);
  }

  if (message.startsWith("Invalid transition:")) {
    return conflict(message);
  }

  return internalError();
}

function isRetryableErrorCode(code: string): boolean {
  return (
    code === "NETWORK_ERROR" ||
    code === "TIMEOUT" ||
    code === "OVERLOADED" ||
    code === "INTERNAL_ERROR"
  );
}

function backoffMs(attempt: number, baseMs: number, capMs: number): number {
  const raw = baseMs * Math.pow(2, attempt);
  return raw > capMs ? capMs : raw;
}

export function handleExecuteRun(runId: string, request: ExecuteRequest): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  if (!isObject(request)) {
    return badRequest("Request body must be a JSON object");
  }

  const registry = getAgentRunRegistry();

  try {
    registry.start(runId);
  } catch (err) {
    return mapRegistryError(err);
  }

  const store = getCheckpointStore();
  const runningSnapshot = registry.get(runId);
  if (!runningSnapshot) {
    return internalError();
  }
  store.saveValid(runId, runningSnapshot);

  try {
    const outcome = executeWithFixpoint(request, {
      maxIterations: 20,
      baseBackoffMs: 25,
      maxBackoffMs: 1000,
      onRetry: () => {
        const snap = store.loadLatestValid(runId);
        if (snap) {
          registry.restore(snap);
        }
      },
    });

    if (outcome.status === "completed") {
      const run = registry.complete(runId, {
        execution: outcome.execution as unknown as Record<string, unknown>,
        metrics: {
          fixpointIterations: outcome.iterationsUsed,
          backoffScheduleMs: outcome.backoffScheduleMs,
        },
      });
      return ok(200, run);
    }

    const code = outcome.lastErrorCode ?? "INTERNAL_ERROR";
    const message = outcome.lastErrorMessage ?? "Execution failed";
    const failedRun = registry.fail(runId, code, message);
    return ok(200, failedRun);
  } catch {
    try {
      const failedRun = registry.fail(runId, "INTERNAL_ERROR", "Unhandled execute exception");
      return ok(200, failedRun);
    } catch (err) {
      return mapRegistryError(err);
    }
  }
}

export async function handleExecuteRunAsync(runId: string, request: ExecuteRequest): Promise<HttpJsonResult> {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  if (!isObject(request)) {
    return badRequest("Request body must be a JSON object");
  }

  const registry = getAgentRunRegistry();

  try {
    registry.start(runId);
  } catch (err) {
    return mapRegistryError(err);
  }

  const store = getCheckpointStore();
  const runningSnapshot = registry.get(runId);
  if (!runningSnapshot) {
    return internalError();
  }
  store.saveValid(runId, runningSnapshot);

  const maxIterations = 20;
  const baseBackoffMs = 25;
  const maxBackoffMs = 1000;
  const schedule: number[] = [];
  let lastErrorCode: string | undefined;
  let lastErrorMessage: string | undefined;


  for (let iter = 0; iter < maxIterations; iter++) {
    try {
      const result: DeterministicResponse<any> = await executeDeterministicPlanAsync(request.plan, { mode: request.mode, maxSteps: request.maxSteps, traceId: request.traceId }, { sandboxFactory: localPlaywrightSandbox });

      if (result.ok) {
        const run = registry.complete(runId, {
          execution: result as unknown as Record<string, unknown>,
          metrics: {
            fixpointIterations: iter + 1,
            backoffScheduleMs: schedule,
          },
        });
        return ok(200, run);
      }

      const code = result.error.code;
      const msg = result.error.message;
      lastErrorCode = code;
      lastErrorMessage = msg;

      if (!isRetryableErrorCode(code)) {
        const failedRun = registry.fail(runId, code, msg);
        return ok(200, failedRun);
      }

      schedule.push(backoffMs(iter, baseBackoffMs, maxBackoffMs));
      const snap = store.loadLatestValid(runId);
      if (snap) {
        registry.restore(snap);
      }
      // determinista: no sleep real
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorCode = "INTERNAL_ERROR";
      lastErrorMessage = msg;
      schedule.push(backoffMs(iter, baseBackoffMs, maxBackoffMs));
      const snap = store.loadLatestValid(runId);
      if (snap) {
        registry.restore(snap);
      }
      if (!isRetryableErrorCode("INTERNAL_ERROR")) {
        const failedRun = registry.fail(runId, "INTERNAL_ERROR", msg);
        return ok(200, failedRun);
      }
      continue;
    }
  }

  const code = lastErrorCode ?? "FIXPOINT_MAX_ITER";
  const message = lastErrorMessage ?? "Fixpoint did not converge within max iterations";
  const failedRun = registry.fail(runId, code, message);
  return ok(200, failedRun);
}



