import type { DeterministicAgentPlan, AgentExecutionResult } from "../agent/plan-types";
import type { ExecutionMode, DeterministicResponse } from "../core/contracts";

/**
 * Input ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“alto nivelÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â para correr un agente (planner -> plan -> executor).
 */
export interface AgentRunInput {
  goal: string;
  demo: "core" | "sandbox";
  mode: ExecutionMode; // "mock" | "local"
  maxSteps: number;
  planner?: "mock" | "deterministic" | "det-tools" | "det-replan" | "det-replan2" | "llm-mock";
  traceId?: string;
  sandboxUrl?: string;


  // Replan context (bounded; deterministic)
  history?: { role: "user" | "assistant"; content: string }[];
  lastErrorCode?: string;
}

/**
 * Planner determinista (por ahora mock).
 */
export interface Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan;
}

/**
 * Registry contract types (must match src/agent-run/registry.ts expectations).
 */
export type AgentRunStatus = "created" | "running" | "succeeded" | "failed" | "cancelled";

export interface AgentRunError {
  code: string;
  message: string;
}

export interface AgentRunTimestamps {
  createdAt: string;
  // registry.ts crea el record inicial con { createdAt } y luego actualiza
  updatedAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AgentRunDeterminism {
  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
  traceSchemaVersion?: number;
  traceId?: string;
}

export interface AgentRunRecord {
  runId: string;
  agentId: string;
  status: AgentRunStatus;

  // registry.ts asigna requestId en el record inicial
  requestId?: string;

  // registry.ts crea metadata: input.metadata ? {...} : {}
  metadata: Record<string, unknown>;

  input?: AgentRunInput;
  plan?: DeterministicAgentPlan;

  output?: AgentExecutionResult;
  error?: AgentRunError;

  timestamps: AgentRunTimestamps;
  determinism: AgentRunDeterminism;
}

/**
 * Inputs for lifecycle transitions (names/shapes aligned to registry.ts).
 */
export interface CreateAgentRunInput {
  // registry.ts requiere runId (lo valida y lo usa como key)
  runId: string;

  agentId: string;
  requestId?: string;

  // registry.ts clona metadata si existe
  metadata?: Record<string, unknown>;

  input?: AgentRunInput;

  // registry.ts assertIsoTimestamp(input.createdAt)
  createdAt: string;

  // registry.ts valida que sea integer y > 0 (por eso NO puede ser opcional)
  traceSchemaVersion: number;

  traceId?: string;

  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
}

export interface StartAgentRunInput {
  runId: string;
  startedAt: string;
}

export interface SucceedAgentRunInput {
  runId: string;
  output: AgentExecutionResult;

  finishedAt: string;
  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
  traceSchemaVersion?: number;
}

export interface FailAgentRunInput {
  runId: string;
  error: AgentRunError;

  finishedAt: string;
  planHash?: string;
  executionHash?: string;
  finalTraceLinkHash?: string;
  traceSchemaVersion?: number;
}

/**
 * Interface expected by registry.ts.
 */
export interface AgentRunRegistry {
  create(input: CreateAgentRunInput): AgentRunRecord;
  get(runId: string): AgentRunRecord | undefined;

  start(input: StartAgentRunInput): AgentRunRecord;
  succeed(input: SucceedAgentRunInput): AgentRunRecord;
  fail(input: FailAgentRunInput): AgentRunRecord;
}

/**
 * Outcome type for runAgent (planner + executor).
 */
export type AgentRunOutcome = DeterministicResponse<AgentExecutionResult>;
