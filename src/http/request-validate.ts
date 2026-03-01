import type { ExecuteRequest } from "./request-types";
import type { DeterministicAgentPlan } from "../agent";

type UnknownRecord = Record<string, unknown>;

export interface RequestValidationIssue {
  field: string;
  reason: string;
}
export interface RequestValidationOk {
  ok: true;
  value: ExecuteRequest;
}

export interface RequestValidationFail {
  ok: false;
  error: string;
  issues: RequestValidationIssue[];
}

export type RequestValidationResult = RequestValidationOk | RequestValidationFail;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlan(value: unknown): value is DeterministicAgentPlan {
  if (!isObject(value)) return false;
  if (!isNonEmptyString(value.planId)) return false;
  if (value.version !== 1) return false;
  if (!Array.isArray(value.steps)) return false;
  return true;
}

export function validateExecuteRequest(input: unknown): RequestValidationResult {
  if (!isObject(input)) {
    return { ok: false, error: "Request body must be a JSON object", issues: [{ field: "body", reason: "must be a JSON object" }] };
  }

  const mode = input.mode;
  if (mode !== "local" && mode !== "mock") {
    return { ok: false, error: "mode must be 'local' or 'mock'", issues: [{ field: "mode", reason: "must be 'local' or 'mock'" }] };
  }

  const maxSteps = input.maxSteps;
  if (typeof maxSteps !== "number" || !Number.isInteger(maxSteps) || maxSteps <= 0) {
    return { ok: false, error: "maxSteps must be a positive integer", issues: [{ field: "maxSteps", reason: "must be a positive integer" }] };
  }

  const traceId = input.traceId;
  if (typeof traceId !== "undefined") {
    if (!isNonEmptyString(traceId)) {
      return { ok: false, error: "traceId must be a non-empty string when provided", issues: [{ field: "traceId", reason: "must be a non-empty string when provided" }] };
    }
    if (traceId.length > 256) {
      return { ok: false, error: "traceId exceeds 256 characters", issues: [{ field: "traceId", reason: "exceeds 256 characters" }] };
    }
  }

  const plan = input.plan;
  if (!isPlan(plan)) {
    return { ok: false, error: "plan must be a valid version 1 plan object", issues: [{ field: "plan", reason: "must be a valid version 1 plan object" }] };
  }

  return {
    ok: true,
    value: {
      mode,
      maxSteps,
      traceId,
      plan,
    },
  };
}
