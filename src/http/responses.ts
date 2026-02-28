import type { ServerResponse } from "node:http";
import { ERROR_CODES } from "../core/error-codes";
import type { ExecutionMode } from "../core/contracts";

interface ErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    requestId?: string;
    mode?: ExecutionMode;
    stepCount?: number;
    traceId?: string;
  };
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(payload, "utf8"));
  res.end(payload);
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  writeJson(res, statusCode, body);
}

export function sendError(
  res: ServerResponse,
  params: {
    statusCode: number;
    code: string;
    message: string;
    retryable?: boolean;
    mode?: ExecutionMode;
    stepCount?: number;
    traceId?: string;
  }
): void {
  const body: ErrorPayload = {
    ok: false,
    error: {
      code: params.code,
      message: params.message,
      retryable: params.retryable === true,
    },
    meta: {},
  };

  const rid = res.getHeader("x-request-id");
  if (typeof rid === "string" && rid.length > 0) body.meta.requestId = rid;

  if (typeof params.mode !== "undefined") body.meta.mode = params.mode;
  if (typeof params.stepCount !== "undefined") body.meta.stepCount = params.stepCount;
  if (typeof params.traceId !== "undefined") body.meta.traceId = params.traceId;

  writeJson(res, params.statusCode, body);
}

export function sendNotFound(res: ServerResponse): void {
  sendError(res, {
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
    message: "Route not found",
    retryable: false,
  });
}

export function sendMethodNotAllowed(res: ServerResponse): void {
  sendError(res, {
    statusCode: 405,
    code: ERROR_CODES.METHOD_NOT_ALLOWED,
    message: "Method not allowed",
    retryable: false,
  });
}

export function sendMalformedRequest(res: ServerResponse): void {
  sendError(res, {
    statusCode: 400,
    code: ERROR_CODES.MALFORMED_REQUEST,
    message: "Malformed JSON request body",
    retryable: false,
  });
}

export function sendInvalidRequest(
  res: ServerResponse,
  message: string,
  mode?: ExecutionMode,
  traceId?: string
): void {
  sendError(res, {
    statusCode: 400,
    code: ERROR_CODES.INVALID_REQUEST,
    message,
    retryable: false,
    mode,
    traceId,
  });
}

export function sendInternalError(res: ServerResponse, traceId?: string): void {
  sendError(res, {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Internal server error",
    retryable: false,
    traceId,
  });
}
