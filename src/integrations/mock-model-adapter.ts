import type { ModelAdapter, ModelGenerateRequest, ModelGenerateResponse } from "./types";
import { deterministicHashLike } from "./hash";

export class MockModelAdapter implements ModelAdapter {
  public readonly adapterId = "mock-model-v1";

  public generate(request: ModelGenerateRequest): ModelGenerateResponse {
    const normalized = {
      prompt: String(request.prompt),
      maxTokens: Number(request.maxTokens),
      temperature: Number(request.temperature),
    };

    const digest = deterministicHashLike("mm", normalized);
    const text = [
      "MOCK_MODEL_RESPONSE",
      "digest=" + digest,
      "prompt=" + normalized.prompt,
      "maxTokens=" + String(normalized.maxTokens),
      "temperature=" + String(normalized.temperature),
    ].join("; ");

    const tokenCount = Math.min(
      normalized.maxTokens,
      Math.max(1, text.split(/\s+/).filter((x) => x.length > 0).length)
    );

    return {
      text,
      modelId: this.adapterId,
      tokenCount,
      deterministic: true,
    };
  }
}