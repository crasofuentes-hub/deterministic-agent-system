import { deterministicHashLike, stableStringify } from "./hash";
import type { HttpTransport } from "./http-transport";
import type {
  AsyncModelAdapter,
  OpenAICompatibleAdapterConfig,
  OpenAICompatibleChatCompletionsRequest,
  OpenAICompatibleChatCompletionsResponse,
  ProviderModelGenerateResponse,
} from "./provider-types";
import type { ModelGenerateRequest } from "./types";

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function requireNonEmpty(value: string, name: string): string {
  const v = String(value ?? "").trim();
  if (v.length === 0) throw new Error(name + " must be a non-empty string");
  return v;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Provider response must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function extractFirstAssistantText(payload: OpenAICompatibleChatCompletionsResponse): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  const content = first && first.message ? first.message.content : undefined;
  if (typeof content !== "string") {
    throw new Error("Provider response missing choices[0].message.content");
  }
  return content;
}

function safeProviderTokenCount(payload: OpenAICompatibleChatCompletionsResponse, fallbackText: string): number {
  const total = payload.usage && typeof payload.usage.total_tokens === "number" ? payload.usage.total_tokens : undefined;
  if (typeof total === "number" && Number.isFinite(total) && total >= 0) {
    return Math.floor(total);
  }
  return Math.max(1, fallbackText.split(/\s+/).filter((x) => x.length > 0).length);
}

export class OpenAICompatibleModelAdapter implements AsyncModelAdapter {
  public readonly adapterId: string;
  private readonly cfg: Required<Omit<OpenAICompatibleAdapterConfig, "timeoutMs" | "defaultTemperature" | "maxInputChars">> & {
    timeoutMs: number;
    defaultTemperature: number;
    maxInputChars: number;
  };
  private readonly transport: HttpTransport;

  public constructor(config: OpenAICompatibleAdapterConfig, transport: HttpTransport) {
    this.cfg = {
      baseUrl: trimTrailingSlash(requireNonEmpty(config.baseUrl, "baseUrl")),
      apiKey: requireNonEmpty(config.apiKey, "apiKey"),
      model: requireNonEmpty(config.model, "model"),
      timeoutMs: typeof config.timeoutMs === "number" && config.timeoutMs > 0 ? Math.floor(config.timeoutMs) : 30000,
      defaultTemperature:
        typeof config.defaultTemperature === "number" && Number.isFinite(config.defaultTemperature)
          ? config.defaultTemperature
          : 0,
      maxInputChars: typeof config.maxInputChars === "number" && config.maxInputChars > 0 ? Math.floor(config.maxInputChars) : 20000,
    };
    this.transport = transport;
    this.adapterId = "openai-compatible:" + this.cfg.model;
  }

  public async generateAsync(request: ModelGenerateRequest): Promise<ProviderModelGenerateResponse> {
    const prompt = String(request.prompt ?? "").normalize("NFC");
    if (prompt.trim().length === 0) {
      throw new Error("prompt must be non-empty");
    }
    if (prompt.length > this.cfg.maxInputChars) {
      throw new Error("prompt exceeds maxInputChars");
    }

    const maxTokens = Number.isInteger(request.maxTokens) && request.maxTokens > 0 ? request.maxTokens : 256;
    const temperature =
      typeof request.temperature === "number" && Number.isFinite(request.temperature)
        ? request.temperature
        : this.cfg.defaultTemperature;

    const reqBody: OpenAICompatibleChatCompletionsRequest = {
      model: this.cfg.model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    };

    const bodyText = JSON.stringify(reqBody);
    const requestFingerprint = deterministicHashLike("rq", {
      url: this.cfg.baseUrl + "/chat/completions",
      body: reqBody,
    });

    const http = await this.transport.request({
      method: "POST",
      url: this.cfg.baseUrl + "/chat/completions",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + this.cfg.apiKey,
      },
      body: bodyText,
      timeoutMs: this.cfg.timeoutMs,
    });

    if (http.status < 200 || http.status >= 300) {
      throw new Error("Provider HTTP error: " + String(http.status));
    }

    const parsed = parseJsonObject(http.bodyText) as OpenAICompatibleChatCompletionsResponse;
    const text = extractFirstAssistantText(parsed);
    const tokenCount = safeProviderTokenCount(parsed, text);
    const responseFingerprint = deterministicHashLike("rs", stableStringify(parsed));

    return {
      text,
      modelId: typeof parsed.model === "string" && parsed.model.length > 0 ? parsed.model : this.cfg.model,
      tokenCount,
      deterministic: false,
      evidence: {
        providerKind: "openai-compatible",
        endpoint: this.cfg.baseUrl + "/chat/completions",
        model: this.cfg.model,
        requestFingerprint,
        responseFingerprint,
        httpStatus: http.status,
        providerDeterminism: "unknown",
      },
    };
  }
}