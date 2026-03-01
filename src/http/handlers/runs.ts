import { getAgentRunRegistry } from "../runs/registry";
import type {
  CancelRunRequest,
  CompleteRunRequest,
  CreateRunRequest,
  FailRunRequest,
  HttpJsonResult,
} from "../runs/types";

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

function parseCreateRunRequest(input: unknown): CreateRunRequest | HttpJsonResult {
  if (!isObject(input)) {
    return badRequest("Request body must be a JSON object");
  }

  if (typeof input.agentId !== "string" || input.agentId.trim().length === 0) {
    return badRequest("agentId must be a non-empty string");
  }

  if (typeof input.input !== "undefined" && !isObject(input.input)) {
    return badRequest("input must be a JSON object when provided");
  }

  return {
    agentId: input.agentId,
    input: isObject(input.input) ? input.input : undefined,
  };
}

function parseCompleteRunRequest(input: unknown): CompleteRunRequest | HttpJsonResult {
  if (!isObject(input)) {
    return badRequest("Request body must be a JSON object");
  }

  if (typeof input.output !== "undefined" && !isObject(input.output)) {
    return badRequest("output must be a JSON object when provided");
  }

  return {
    output: isObject(input.output) ? input.output : undefined,
  };
}

function parseFailRunRequest(input: unknown): FailRunRequest | HttpJsonResult {
  if (!isObject(input)) {
    return badRequest("Request body must be a JSON object");
  }

  if (typeof input.code !== "string" || input.code.trim().length === 0) {
    return badRequest("code must be a non-empty string");
  }

  if (typeof input.message !== "string" || input.message.trim().length === 0) {
    return badRequest("message must be a non-empty string");
  }

  return {
    code: input.code,
    message: input.message,
  };
}

function parseCancelRunRequest(input: unknown): CancelRunRequest | HttpJsonResult {
  if (!isObject(input)) {
    return badRequest("Request body must be a JSON object");
  }

  if (typeof input.reason !== "undefined" && typeof input.reason !== "string") {
    return badRequest("reason must be a string when provided");
  }

  return {
    reason: typeof input.reason === "string" ? input.reason : undefined,
  };
}

function isHttpJsonResult(value: unknown): value is HttpJsonResult {
  return isObject(value) && typeof value.statusCode === "number" && isObject(value.body);
}

function mapRegistryError(err: unknown): HttpJsonResult {
  const message = err instanceof Error ? err.message : String(err);

  if (message.startsWith("Run not found:")) {
    return notFound(message);
  }

  if (message.startsWith("Invalid transition:")) {
    return conflict(message);
  }

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

export function handleCreateRun(body: unknown): HttpJsonResult {
  const parsed = parseCreateRunRequest(body);
  if (isHttpJsonResult(parsed)) {
    return parsed;
  }

  try {
    const run = getAgentRunRegistry().create(parsed);
    return ok(201, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}

export function handleGetRun(runId: string): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  try {
    const run = getAgentRunRegistry().get(runId);
    if (!run) {
      return notFound(`Run not found: ${runId}`);
    }
    return ok(200, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}

export function handleStartRun(runId: string, body: unknown): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  if (!isObject(body)) {
    return badRequest("Request body must be a JSON object");
  }

  try {
    const run = getAgentRunRegistry().start(runId);
    return ok(200, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}

export function handleCompleteRun(runId: string, body: unknown): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  const parsed = parseCompleteRunRequest(body);
  if (isHttpJsonResult(parsed)) {
    return parsed;
  }

  try {
    const run = getAgentRunRegistry().complete(runId, parsed.output);
    return ok(200, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}

export function handleFailRun(runId: string, body: unknown): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  const parsed = parseFailRunRequest(body);
  if (isHttpJsonResult(parsed)) {
    return parsed;
  }

  try {
    const run = getAgentRunRegistry().fail(runId, parsed.code, parsed.message);
    return ok(200, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}

export function handleCancelRun(runId: string, body: unknown): HttpJsonResult {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return badRequest("runId must be a non-empty string");
  }

  const parsed = parseCancelRunRequest(body);
  if (isHttpJsonResult(parsed)) {
    return parsed;
  }

  try {
    const run = getAgentRunRegistry().cancel(runId, parsed.reason);
    return ok(200, run);
  } catch (err) {
    return mapRegistryError(err);
  }
}
