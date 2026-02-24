import { deterministicHashLike } from "./hash";
import { MockModelAdapter } from "./mock-model-adapter";
import { MockVectorStoreAdapter } from "./mock-vector-store";
import { MemoryEventStreamSink } from "./memory-stream-sink";
import type { SimulationRequest, SimulationResult, StreamEvent } from "./types";

function validateSimulationRequest(input: SimulationRequest): void {
  if (typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
    throw new Error("prompt must be a non-empty string");
  }
  if (!Number.isInteger(input.topK) || input.topK <= 0) {
    throw new Error("topK must be a positive integer");
  }
  if (!Number.isInteger(input.maxTokens) || input.maxTokens <= 0) {
    throw new Error("maxTokens must be a positive integer");
  }
}

export function simulateIntegratedExecution(input: SimulationRequest): SimulationResult {
  validateSimulationRequest(input);

  const model = new MockModelAdapter();
  const vector = new MockVectorStoreAdapter();
  const sink = new MemoryEventStreamSink();

  const retrieval = vector.search({
    query: input.prompt,
    topK: input.topK,
  });

  const modelOutput = model.generate({
    prompt: input.prompt,
    maxTokens: input.maxTokens,
    temperature: 0,
  });

  const events: StreamEvent[] = [
    { seq: 1, type: "info", data: "retrieval_hits=" + String(retrieval.hits.length) },
    { seq: 2, type: "token", data: modelOutput.text },
    { seq: 3, type: "done", data: "ok" },
  ];

  const write = sink.write(events);

  const adapterSetId = [model.adapterId, vector.adapterId, sink.sinkId].join("+");
  const executionHashLike = deterministicHashLike("sx", {
    adapterSetId,
    request: {
      prompt: input.prompt,
      topK: input.topK,
      maxTokens: input.maxTokens,
    },
    retrieval,
    model: modelOutput,
    stream: sink.snapshot(),
  });

  return {
    adapterSetId,
    model: modelOutput,
    retrieval,
    stream: {
      sinkId: sink.sinkId,
      events: sink.snapshot(),
      acceptedCount: write.count,
    },
    executionHashLike,
  };
}
