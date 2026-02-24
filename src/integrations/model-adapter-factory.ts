import { FetchHttpTransport } from "./http-transport";
import { MockModelAdapter } from "./mock-model-adapter";
import { OpenAICompatibleModelAdapter } from "./openai-compatible-model-adapter";
import type { ModelAdapterSelection } from "./provider-types";

export interface ModelAdapterFactoryInput {
  provider: "mock" | "openai-compatible";
  openaiCompatible?: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs?: number;
    defaultTemperature?: number;
    maxInputChars?: number;
  };
}

export function createModelAdapterSelection(
  input: ModelAdapterFactoryInput
): ModelAdapterSelection {
  if (input.provider === "mock") {
    return {
      syncAdapter: new MockModelAdapter(),
    };
  }

  if (input.provider === "openai-compatible") {
    if (!input.openaiCompatible) {
      throw new Error("openaiCompatible config is required");
    }

    return {
      asyncAdapter: new OpenAICompatibleModelAdapter(
        input.openaiCompatible,
        new FetchHttpTransport()
      ),
    };
  }

  throw new Error("Unsupported provider");
}
