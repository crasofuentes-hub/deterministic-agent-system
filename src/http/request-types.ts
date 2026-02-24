import type { DeterministicAgentPlan } from "../agent";

export interface ExecuteRequest {
  mode: "local" | "mock";
  maxSteps: number;
  traceId?: string;
  plan: DeterministicAgentPlan;
}