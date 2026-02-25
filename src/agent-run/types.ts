export type AgentRunStatus = "created" | "running" | "succeeded" | "failed";

export interface AgentRunTimestamps {
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AgentRunDeterminism {
  traceSchemaVersion: number;
  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
}

export interface AgentRunError {
  code: string;
  message: string;
}

export interface AgentRunRecord {
  runId: string;
  agentId: string;
  requestId?: string;
  status: AgentRunStatus;
  timestamps: AgentRunTimestamps;
  determinism: AgentRunDeterminism;
  metadata: Record<string, string>;
  error?: AgentRunError;
}

export interface CreateAgentRunInput {
  runId: string;
  agentId: string;
  requestId?: string;
  createdAt: string;
  traceSchemaVersion: number;
  metadata?: Record<string, string>;
}

export interface StartAgentRunInput {
  runId: string;
  startedAt: string;
}

export interface SucceedAgentRunInput {
  runId: string;
  finishedAt: string;
  planHash: string;
  executionHash: string;
  finalTraceLinkHash: string;
}

export interface FailAgentRunInput {
  runId: string;
  finishedAt: string;
  error: AgentRunError;
  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
}

export interface AgentRunRegistry {
  create(input: CreateAgentRunInput): AgentRunRecord;
  start(input: StartAgentRunInput): AgentRunRecord;
  succeed(input: SucceedAgentRunInput): AgentRunRecord;
  fail(input: FailAgentRunInput): AgentRunRecord;
  get(runId: string): AgentRunRecord | undefined;
  list(): AgentRunRecord[];
}