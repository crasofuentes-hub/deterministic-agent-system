import { executeDeterministicPlan } from "../../agent";
import type { ExecuteRequest } from "../request-types";
import { getAgentRunRegistry } from "../runs/registry";
import type { HttpJsonResult } from "../runs/types";

type UnknownRecord = Record<string, unknown>;

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
      },
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
      },
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
      },
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
      },
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

  try {
    const result = executeDeterministicPlan(request.plan, {
      mode: request.mode,
      maxSteps: request.maxSteps,
      traceId: request.traceId,
    });

    if (result.ok) {
      const run = registry.complete(runId, {
        execution: result as unknown as Record<string, unknown>,
      });
      return ok(200, run);
    }

    const failedRun = registry.fail(runId, result.error.code, result.error.message);
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
