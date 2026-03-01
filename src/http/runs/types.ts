export type RunStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunRecord {
  runId: string;
  agentId: string;
  status: RunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  agentId: string;
  input?: Record<string, unknown>;
}

export interface StartRunRequest {
  // reservado para metadata futura
}

export interface CompleteRunRequest {
  output?: Record<string, unknown>;
}

export interface FailRunRequest {
  code: string;
  message: string;
}

export interface CancelRunRequest {
  reason?: string;
}

export interface HttpJsonResult {
  statusCode: number;
  body: {
    ok: boolean;
    result?: unknown;
    error?: {
      code: string;
      message: string;
      retryable?: boolean;
    };
    meta?: Record<string, unknown>;
  };
}
