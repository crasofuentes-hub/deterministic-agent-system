import type { ServerResponse } from "node:http";
import { success } from "../../core/contracts";
import { sendError, sendJson } from "../responses";
import {
  ToolRegistry,
  EchoToolAdapter,
  SumToolAdapter,
  executeToolRequest,
  JsonObject,
} from "../../tools";

type ToolExecuteHttpRequest = {
  toolName: string;
  input: JsonObject;
  timeoutMs?: number;
  traceId?: string;
  requestId?: string;
};

const registry = new ToolRegistry([new EchoToolAdapter(), new SumToolAdapter()]);

export async function handleToolExecute(
  res: ServerResponse,
  body: ToolExecuteHttpRequest
): Promise<void> {
  try {
    const timeoutMs =
      typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs) && body.timeoutMs > 0
        ? Math.floor(body.timeoutMs)
        : 1000;

    const result = await executeToolRequest(
      registry,
      {
        toolName: body.toolName,
        input: body.input,
      },
      {
        timeoutMs,
        traceId: body.traceId,
        requestId: body.requestId,
      }
    );

    sendJson(
      res,
      result.ok ? 200 : 400,
      success(
        {
          tool: result,
        },
        {
          mode: "mock",
          traceId: body.traceId,
          stepCount: 1,
        }
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, {
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: "tool execute handler failed: " + message,
      retryable: false,
      mode: "mock",
      traceId: body.traceId,
    });
  }
}
