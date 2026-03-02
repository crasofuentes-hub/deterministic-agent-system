import type { DeterministicResponse } from "../core/contracts";
import type { AgentExecutionResult } from "../agent/plan-types";
import { executeDeterministicPlan } from "../agent/executor";
import { executeDeterministicPlanAsync } from "../agent/executor-async";
import type { AgentRunInput, Planner } from "./types";

export async function runAgent(
  input: AgentRunInput,
  planner: Planner
): Promise<DeterministicResponse<AgentExecutionResult>> {
  const plan = planner.plan(input);

  if (input.mode === "local") {
    return await executeDeterministicPlanAsync(plan, {
      mode: input.mode,
      maxSteps: input.maxSteps,
      traceId: input.traceId,
    });
  }

  return executeDeterministicPlan(plan, {
    mode: input.mode,
    maxSteps: input.maxSteps,
    traceId: input.traceId,
  });
}