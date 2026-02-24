import type { IncomingMessage, ServerResponse } from "node:http";
import { handleExecute } from "./handlers/execute";
import { handleSimulate } from "./handlers/simulate";
import { handleSimulateModel } from "./handlers/simulate-model";
import { handleToolExecute } from "./handlers/tool-execute";
import { createRequestId, logHttpEvent } from "./observability";
import {
  sendInternalError,
  sendInvalidRequest,
  sendMalformedRequest,
  sendMethodNotAllowed,
  sendNotFound,
  sendJson,
} from "./responses";
import { validateExecuteRequest } from "./request-validate";
import type { JsonObject } from "../tools";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withRequestId(res: ServerResponse, requestId: string): void {
  if (!res.headersSent) {
    res.setHeader("x-request-id", requestId);
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer | string) => {
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += b.length;

      if (total > 1024 * 1024) {
        reject(new Error("Request body too large"));
        return;
      }

      chunks.push(b);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function validateSimulateRequest(input: unknown):
  | { ok: true; value: { prompt: string; topK: number; maxTokens: number; traceId?: string } }
  | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  if (typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
    return { ok: false, error: "prompt must be a non-empty string" };
  }

  if (typeof input.topK !== "number" || !Number.isInteger(input.topK) || input.topK <= 0) {
    return { ok: false, error: "topK must be a positive integer" };
  }

  if (typeof input.maxTokens !== "number" || !Number.isInteger(input.maxTokens) || input.maxTokens <= 0) {
    return { ok: false, error: "maxTokens must be a positive integer" };
  }

  if (typeof input.traceId !== "undefined") {
    if (typeof input.traceId !== "string" || input.traceId.trim().length === 0) {
      return { ok: false, error: "traceId must be a non-empty string when provided" };
    }
  }

  return {
    ok: true,
    value: {
      prompt: input.prompt,
      topK: input.topK,
      maxTokens: input.maxTokens,
      traceId: typeof input.traceId === "string" ? input.traceId : undefined,
    },
  };
}

function validateSimulateModelRequest(input: unknown):
  | { ok: true; value: { provider: "mock" | "openai-compatible"; prompt: string; maxTokens: number; temperature?: number; traceId?: string } }
  | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  if (input.provider !== "mock" && input.provider !== "openai-compatible") {
    return { ok: false, error: "provider must be 'mock' or 'openai-compatible'" };
  }

  if (typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
    return { ok: false, error: "prompt must be a non-empty string" };
  }

  if (typeof input.maxTokens !== "number" || !Number.isInteger(input.maxTokens) || input.maxTokens <= 0) {
    return { ok: false, error: "maxTokens must be a positive integer" };
  }

  if (typeof input.temperature !== "undefined") {
    if (typeof input.temperature !== "number" || !Number.isFinite(input.temperature)) {
      return { ok: false, error: "temperature must be a finite number when provided" };
    }
  }

  if (typeof input.traceId !== "undefined") {
    if (typeof input.traceId !== "string" || input.traceId.trim().length === 0) {
      return { ok: false, error: "traceId must be a non-empty string when provided" };
    }
  }

  return {
    ok: true,
    value: {
      provider: input.provider,
      prompt: input.prompt,
      maxTokens: input.maxTokens,
      temperature: typeof input.temperature === "number" ? input.temperature : undefined,
      traceId: typeof input.traceId === "string" ? input.traceId : undefined,
    },
  };
}


function validateToolExecuteRequest(input: unknown):
  | { ok: true; value: { toolName: string; input: JsonObject; timeoutMs?: number; traceId?: string } }
  | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  if (typeof input.toolName !== "string" || input.toolName.trim().length === 0) {
    return { ok: false, error: "toolName must be a non-empty string" };
  }

  if (!isObject(input.input)) {
    return { ok: false, error: "input must be a JSON object" };
  }

  if (typeof input.timeoutMs !== "undefined") {
    if (typeof input.timeoutMs !== "number" || !Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
      return { ok: false, error: "timeoutMs must be a positive finite number when provided" };
    }
  }

  if (typeof input.traceId !== "undefined") {
    if (typeof input.traceId !== "string" || input.traceId.trim().length === 0) {
      return { ok: false, error: "traceId must be a non-empty string when provided" };
    }
  }

  return {
    ok: true,
    value: {
      toolName: input.toolName,
      input: input.input as JsonObject,
      timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
      traceId: typeof input.traceId === "string" ? input.traceId : undefined,
    },
  };
}
function sendHealth(res: ServerResponse, requestId: string): void {
  withRequestId(res, requestId);
  sendJson(res, 200, {
    ok: true,
    result: {
      service: "deterministic-agent-system-http",
      status: "ok",
    },
    meta: {
      requestId,
    },
  });
}

function logEnd(
  req: IncomingMessage,
  res: ServerResponse,
  requestId: string,
  startedAt: number,
  extra?: Record<string, unknown>
): void {
  logHttpEvent({
    event: "request.end",
    requestId,
    method: req.method ?? "GET",
    url: req.url ?? "/",
    statusCode: res.statusCode,
    durationMs: Date.now() - startedAt,
    ...(extra ?? {}),
  });
}

export async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const requestId = createRequestId();

  withRequestId(res, requestId);

  logHttpEvent({
    event: "request.start",
    requestId,
    method: req.method ?? "GET",
    url: req.url ?? "/",
  });

  try {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";

    if (url === "/health") {
      if (method !== "GET") {
        withRequestId(res, requestId);
        sendMethodNotAllowed(res);
        logEnd(req, res, requestId, startedAt);
        return;
      }

      sendHealth(res, requestId);
      logEnd(req, res, requestId, startedAt);
      return;
    }

    if (url !== "/execute" && url !== "/simulate" && url !== "/simulate-model" && url !== "/tool/execute") {
      withRequestId(res, requestId);
      sendNotFound(res);
      logEnd(req, res, requestId, startedAt);
      return;
    }

    if (method !== "POST") {
      withRequestId(res, requestId);
      sendMethodNotAllowed(res);
      logEnd(req, res, requestId, startedAt);
      return;
    }

    let raw = "";
    try {
      raw = await readRequestBody(req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      withRequestId(res, requestId);
      sendInvalidRequest(res, msg);
      logEnd(req, res, requestId, startedAt, { error: msg });
      return;
    }

    let parsed: unknown;
    try {
      parsed = raw.length === 0 ? {} : JSON.parse(raw);
    } catch {
      withRequestId(res, requestId);
      sendMalformedRequest(res);
      logEnd(req, res, requestId, startedAt, { error: "Malformed JSON" });
      return;
    }

    if (url === "/execute") {
      const validation = validateExecuteRequest(parsed);
      if (!validation.ok) {
        withRequestId(res, requestId);
        sendInvalidRequest(res, "Request validation failed: " + validation.error);
        logEnd(req, res, requestId, startedAt, { error: validation.error });
        return;
      }

      withRequestId(res, requestId);
      handleExecute(res, validation.value);
      logEnd(req, res, requestId, startedAt);
      return;
    }

    if (url === "/simulate") {
      const validation = validateSimulateRequest(parsed);
      if (!validation.ok) {
        withRequestId(res, requestId);
        sendInvalidRequest(res, "Request validation failed: " + validation.error, "mock");
        logEnd(req, res, requestId, startedAt, { error: validation.error });
        return;
      }

      withRequestId(res, requestId);
      handleSimulate(res, validation.value);
      logEnd(req, res, requestId, startedAt);
      return;
    }

    if (url === "/simulate-model") {
      const validation = validateSimulateModelRequest(parsed);
      if (!validation.ok) {
        withRequestId(res, requestId);
        sendInvalidRequest(res, "Request validation failed: " + validation.error, "mock");
        logEnd(req, res, requestId, startedAt, { error: validation.error });
        return;
      }

      withRequestId(res, requestId);
      await handleSimulateModel(res, validation.value);
      logEnd(req, res, requestId, startedAt);
      return;
    }
    if (url === "/tool/execute") {
      const validation = validateToolExecuteRequest(parsed);
      if (!validation.ok) {
        withRequestId(res, requestId);
        sendInvalidRequest(res, "Request validation failed: " + validation.error, "mock");
        logEnd(req, res, requestId, startedAt, { error: validation.error });
        return;
      }

      withRequestId(res, requestId);
      await handleToolExecute(res, {
        toolName: validation.value.toolName,
        input: validation.value.input,
        timeoutMs: validation.value.timeoutMs,
        traceId: validation.value.traceId,
        requestId,
      });
      logEnd(req, res, requestId, startedAt);
      return;
    }

    withRequestId(res, requestId);
    sendNotFound(res);
    logEnd(req, res, requestId, startedAt);
  } catch (err) {
    withRequestId(res, requestId);
    sendInternalError(res);
    logEnd(req, res, requestId, startedAt, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}