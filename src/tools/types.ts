export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

export interface ToolExecutionContext {
  requestId?: string;
  traceId?: string;
  timeoutMs: number;
  nowIso: string;
}

export interface ToolExecutionRequest {
  toolName: string;
  input: JsonObject;
}

export interface ToolExecutionSuccess {
  ok: true;
  toolName: string;
  deterministic: boolean;
  output: JsonObject;
  meta: {
    durationMs: number;
  };
}

export interface ToolExecutionFailure {
  ok: false;
  toolName: string;
  deterministic: true;
  error: {
    code: "TOOL_NOT_FOUND" | "TOOL_TIMEOUT" | "TOOL_INVALID_INPUT" | "TOOL_EXECUTION_FAILED";
    message: string;
    retryable: boolean;
  };
  meta: {
    durationMs: number;
  };
}

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;

export interface ToolAdapter {
  readonly toolName: string;
  readonly deterministic: boolean;
  execute(
    input: JsonObject,
    ctx: ToolExecutionContext
  ): Promise<ToolExecutionResult> | ToolExecutionResult;
}