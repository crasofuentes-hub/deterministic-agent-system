import type { ErrorCode } from "./error-codes";

export type ExecutionMode = "local" | "mock";

export interface DeterministicError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export interface ResponseMeta {
  mode: ExecutionMode;
  stepCount?: number;
  traceId?: string;
}

export interface SuccessResponse<T> {
  ok: true;
  result: T;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  ok: false;
  error: DeterministicError;
  meta: ResponseMeta;
}

export type DeterministicResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(result: T, meta: ResponseMeta): SuccessResponse<T> {
  return { ok: true, result, meta };
}

export function failure(error: DeterministicError, meta: ResponseMeta): ErrorResponse {
  return { ok: false, error, meta };
}
