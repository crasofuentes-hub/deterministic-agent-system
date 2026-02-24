import type { ServerResponse } from "node:http";
import { success } from "../../core/contracts";
import { simulateIntegratedExecution } from "../../integrations";
import { sendError, sendJson } from "../responses";

type SimRequest = {
  prompt: string;
  topK: number;
  maxTokens: number;
  traceId?: string;
};

export function handleSimulate(res: ServerResponse, body: SimRequest): void {
  try {
    const result = simulateIntegratedExecution({
      prompt: body.prompt,
      topK: body.topK,
      maxTokens: body.maxTokens,
    });

    sendJson(
      res,
      200,
      success(result, {
        mode: "mock",
        stepCount: result.stream.acceptedCount,
        traceId: body.traceId,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, {
      statusCode: 400,
      code: "INVALID_REQUEST",
      message: "Simulation request validation failed: " + message,
      retryable: false,
      mode: "mock",
      traceId: body.traceId,
    });
  }
}
