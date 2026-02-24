import type { ServerResponse } from "node:http";
import { success } from "../../core/contracts";
import { deterministicHashLike, createModelAdapterSelection } from "../../integrations";
import { sendError, sendJson } from "../responses";

type SimModelRequest = {
  provider: "mock" | "openai-compatible";
  prompt: string;
  maxTokens: number;
  temperature?: number;
  traceId?: string;
};

function getEnvRequired(name: string): string {
  const v = process.env[name];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error("Missing environment variable: " + name);
  }
  return v;
}

export async function handleSimulateModel(res: ServerResponse, body: SimModelRequest): Promise<void> {
  try {
    const provider = body.provider;
    const prompt = String(body.prompt ?? "");
    const maxTokens = Number(body.maxTokens);
    const temperature = typeof body.temperature === "number" ? body.temperature : 0;

    if (provider !== "mock" && provider !== "openai-compatible") {
      throw new Error("provider must be 'mock' or 'openai-compatible'");
    }
    if (prompt.trim().length === 0) {
      throw new Error("prompt must be a non-empty string");
    }
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new Error("maxTokens must be a positive integer");
    }

    const selection =
      provider === "mock"
        ? createModelAdapterSelection({ provider: "mock" })
        : createModelAdapterSelection({
            provider: "openai-compatible",
            openaiCompatible: {
              baseUrl: getEnvRequired("OPENAI_COMPAT_BASE_URL"),
              apiKey: getEnvRequired("OPENAI_COMPAT_API_KEY"),
              model: getEnvRequired("OPENAI_COMPAT_MODEL"),
              timeoutMs: process.env.OPENAI_COMPAT_TIMEOUT_MS ? Number(process.env.OPENAI_COMPAT_TIMEOUT_MS) : 30000,
            },
          });

    let modelResult: unknown;
    let providerOutputDeterministic = false;
    let adapterId = "unknown";

    if (selection.syncAdapter) {
      adapterId = selection.syncAdapter.adapterId;
      const r = selection.syncAdapter.generate({
        prompt,
        maxTokens,
        temperature,
      });
      modelResult = r;
      providerOutputDeterministic = false;
    } else if (selection.asyncAdapter) {
      adapterId = selection.asyncAdapter.adapterId;
      const r = await selection.asyncAdapter.generateAsync({
        prompt,
        maxTokens,
        temperature,
      });
      modelResult = r;
      providerOutputDeterministic = false;
    } else {
      throw new Error("No adapter selected");
    }

    const orchestrationFingerprint = deterministicHashLike("or", {
      provider,
      adapterId,
      requestShape: {
        hasPrompt: true,
        maxTokens,
        temperature,
      },
    });

    sendJson(
      res,
      200,
      success(
        {
          provider,
          adapterId,
          orchestrationDeterministic: true,
          providerOutputDeterministic,
          orchestrationFingerprint,
          model: modelResult,
        },
        {
          mode: "mock",
          stepCount: 1,
          traceId: body.traceId,
        }
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, {
      statusCode: 400,
      code: "INVALID_REQUEST",
      message: "simulate-model failed: " + message,
      retryable: false,
      mode: "mock",
      traceId: body.traceId,
    });
  }
}