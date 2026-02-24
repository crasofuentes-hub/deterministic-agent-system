import type { ModelAdapter, ModelGenerateRequest, ModelGenerateResponse } from "./types";

export interface ProviderInvocationEvidence {
  providerKind: "openai-compatible";
  endpoint: string;
  model: string;
  requestFingerprint: string;
  responseFingerprint: string;
  httpStatus: number;
  providerDeterminism: "unknown";
}

export interface ProviderModelGenerateResponse extends Omit<ModelGenerateResponse, "deterministic"> {
  deterministic: false;
  evidence: ProviderInvocationEvidence;
}

export interface AsyncModelAdapter {
  readonly adapterId: string;
  generateAsync(request: ModelGenerateRequest): Promise<ProviderModelGenerateResponse>;
}

export interface OpenAICompatibleAdapterConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  defaultTemperature?: number;
  maxInputChars?: number;
}

export interface OpenAICompatibleChatCompletionsRequest {
  model: string;
  messages: Array<{ role: "user"; content: string }>;
  temperature: number;
  max_tokens: number;
}

export interface OpenAICompatibleChatCompletionsResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface ModelAdapterSelection {
  syncAdapter?: ModelAdapter;
  asyncAdapter?: AsyncModelAdapter;
}