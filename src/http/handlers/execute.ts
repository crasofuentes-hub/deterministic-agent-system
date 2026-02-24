import type { ServerResponse } from "node:http";
import { executeDeterministicPlan } from "../../agent";
import type { ExecuteRequest } from "../request-types";
import { sendJson, sendError } from "../responses";

export function handleExecute(res: ServerResponse, request: ExecuteRequest): void {
  const result = executeDeterministicPlan(request.plan, {
    mode: request.mode,
    maxSteps: request.maxSteps,
    traceId: request.traceId,
  });

  if (result.ok) {
    sendJson(res, 200, result);
    return;
  }

  const code = result.error.code;
  let statusCode = 500;

  if (code === "INVALID_REQUEST" || code === "MALFORMED_REQUEST") {
    statusCode = 400;
  } else if (code === "NOT_FOUND") {
    statusCode = 404;
  } else if (code === "METHOD_NOT_ALLOWED") {
    statusCode = 405;
  } else if (code === "EXECUTION_CONVERGENCE_FAILED") {
    statusCode = 422;
  }

  sendError(res, {
    statusCode,
    code: result.error.code,
    message: result.error.message,
    retryable: result.error.retryable,
    mode: result.meta.mode,
    stepCount: result.meta.stepCount,
    traceId: result.meta.traceId,
  });
}