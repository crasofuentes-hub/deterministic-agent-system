export type AgentStepKind =
  | "set"
  | "increment"
  | "append_log"
  | "sandbox.open"
  | "sandbox.click"
  | "sandbox.type"
  | "sandbox.extract";

export interface AgentStep {
  id: string;
  kind: AgentStepKind;

  // Legacy (v1 core)
  key?: string;
  value?: number | string;

  // Sandbox (enterprise)
  sessionId?: string;
  url?: string;
  selector?: string;
  text?: string;
  outputKey?: string;
}

export interface DeterministicAgentPlan {
  planId: string;
  version: 1;
  steps: AgentStep[];
}

export interface AgentState {
  counters: Record<string, number>;
  values: Record<string, string>;
  logs: string[];
}

export interface StepTrace {
  traceSchemaVersion: number;
  stepIndex: number;
  stepId: string;
  kind: AgentStepKind;
  beforeHashLike: string;
  afterHashLike: string;
  traceLinkHash: string;
  previousTraceLinkHash: string;
  applied: boolean;
}

export interface AgentExecutionResult {
  planId: string;
  planHash: string;
  executionHash: string;
  finalTraceLinkHash: string;
  traceSchemaVersion: number;
  stepsRequested: number;
  stepsExecuted: number;
  converged: boolean;
  finalState: AgentState;
  trace: StepTrace[];
}
