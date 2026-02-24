import { ToolRegistry } from "./registry";
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolExecutionContext,
} from "./types";

export interface ExecuteToolOptions {
  timeoutMs?: number;
  requestId?: string;
  traceId?: string;
  now?: () => Date;
}

function timeoutResult(toolName: string, durationMs: number): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    deterministic: true,
    error: {
      code: "TOOL_TIMEOUT",
      message: "Tool execution exceeded timeout",
      retryable: true,
    },
    meta: {
      durationMs,
    },
  };
}

function notFoundResult(toolName: string, durationMs: number): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    deterministic: true,
    error: {
      code: "TOOL_NOT_FOUND",
      message: "Tool is not registered: " + toolName,
      retryable: false,
    },
    meta: {
      durationMs,
    },
  };
}

function failedResult(toolName: string, message: string, durationMs: number): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    deterministic: true,
    error: {
      code: "TOOL_EXECUTION_FAILED",
      message,
      retryable: false,
    },
    meta: {
      durationMs,
    },
  };
}

export async function executeToolRequest(
  registry: ToolRegistry,
  req: ToolExecutionRequest,
  options: ExecuteToolOptions = {}
): Promise<ToolExecutionResult> {
  const started = Date.now();
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0
    ? Math.floor(options.timeoutMs)
    : 1000;

  const nowFn = options.now ?? (() => new Date());

  const tool = registry.get(req.toolName);
  if (!tool) {
    return notFoundResult(req.toolName, Date.now() - started);
  }

  const ctx: ToolExecutionContext = {
    requestId: options.requestId,
    traceId: options.traceId,
    timeoutMs,
    nowIso: nowFn().toISOString(),
  };

  let timer: NodeJS.Timeout | null = null;

  try {
    const timeoutPromise = new Promise<ToolExecutionResult>((resolve) => {
      timer = setTimeout(() => {
        resolve(timeoutResult(req.toolName, Date.now() - started));
      }, timeoutMs);
    });

    const execPromise = Promise.resolve(tool.execute(req.input, ctx))
      .then((result) => result)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return failedResult(req.toolName, "Tool threw error: " + message, Date.now() - started);
      });

    const result = await Promise.race([execPromise, timeoutPromise]);

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    return result;
  } catch (err) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    const message = err instanceof Error ? err.message : String(err);
    return failedResult(req.toolName, "Executor failure: " + message, Date.now() - started);
  }
}