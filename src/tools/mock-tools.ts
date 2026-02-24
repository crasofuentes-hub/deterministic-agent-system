import type { JsonObject, ToolAdapter, ToolExecutionContext, ToolExecutionResult } from "./types";

function fail(
  toolName: string,
  code: "TOOL_INVALID_INPUT" | "TOOL_EXECUTION_FAILED",
  message: string,
  durationMs: number
): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    deterministic: true,
    error: {
      code,
      message,
      retryable: false,
    },
    meta: {
      durationMs,
    },
  };
}

function ok(toolName: string, output: JsonObject, durationMs: number): ToolExecutionResult {
  return {
    ok: true,
    toolName,
    deterministic: true,
    output,
    meta: {
      durationMs,
    },
  };
}

export class EchoToolAdapter implements ToolAdapter {
  readonly toolName = "echo";
  readonly deterministic = true;

  execute(input: JsonObject, _ctx: ToolExecutionContext): ToolExecutionResult {
    const started = Date.now();

    if (typeof input.message !== "string") {
      return fail(
        this.toolName,
        "TOOL_INVALID_INPUT",
        "message must be a string",
        Date.now() - started
      );
    }

    return ok(
      this.toolName,
      {
        echoed: String(input.message),
        length: String(input.message).length,
      },
      Date.now() - started
    );
  }
}

export class SumToolAdapter implements ToolAdapter {
  readonly toolName = "sum";
  readonly deterministic = true;

  execute(input: JsonObject, _ctx: ToolExecutionContext): ToolExecutionResult {
    const started = Date.now();

    const values = input.values;
    if (!Array.isArray(values)) {
      return fail(
        this.toolName,
        "TOOL_INVALID_INPUT",
        "values must be an array",
        Date.now() - started
      );
    }

    let total = 0;
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return fail(
          this.toolName,
          "TOOL_INVALID_INPUT",
          "values[" + i + "] must be a finite number",
          Date.now() - started
        );
      }
      total += v;
    }

    return ok(
      this.toolName,
      {
        total,
        count: values.length,
      },
      Date.now() - started
    );
  }
}
