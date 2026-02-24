export type AdapterMode = "mock";

export interface ModelGenerateRequest {
  prompt: string;
  maxTokens: number;
  temperature: number;
}

export interface ModelGenerateResponse {
  text: string;
  modelId: string;
  tokenCount: number;
  deterministic: boolean;
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface VectorSearchRequest {
  query: string;
  topK: number;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  content: string;
}

export interface VectorSearchResponse {
  hits: VectorSearchHit[];
  deterministic: boolean;
}

export interface StreamEvent {
  seq: number;
  type: "info" | "token" | "done";
  data: string;
}

export interface StreamWriteResult {
  accepted: true;
  count: number;
}

export interface ModelAdapter {
  readonly adapterId: string;
  generate(request: ModelGenerateRequest): ModelGenerateResponse;
}

export interface VectorStoreAdapter {
  readonly adapterId: string;
  upsert(documents: VectorDocument[]): { inserted: number };
  search(request: VectorSearchRequest): VectorSearchResponse;
}

export interface EventStreamSink {
  readonly sinkId: string;
  write(events: StreamEvent[]): StreamWriteResult;
}

export interface SimulationRequest {
  prompt: string;
  topK: number;
  maxTokens: number;
}

export interface SimulationResult {
  adapterSetId: string;
  model: ModelGenerateResponse;
  retrieval: VectorSearchResponse;
  stream: {
    sinkId: string;
    events: StreamEvent[];
    acceptedCount: number;
  };
  executionHashLike: string;
}