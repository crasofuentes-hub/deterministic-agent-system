import type { DeterministicResponse } from "../core/contracts";
import type { AgentExecutionResult, DeterministicAgentPlan } from "../agent/plan-types";
import { executeDeterministicPlan } from "../agent/executor";
import { executeDeterministicPlanAsync } from "../agent/executor-async";
import type { AgentRunInput, Planner, AsyncPlanner } from "./types";

function hasPlanAsync(planner: Planner): planner is AsyncPlanner {
  return typeof (planner as AsyncPlanner).planAsync === "function";
}

async function resolvePlan(
  input: AgentRunInput,
  planner: Planner
): Promise<DeterministicAgentPlan> {
  if (hasPlanAsync(planner)) {
    return await planner.planAsync(input);
  }
  return planner.plan(input);
}

export async function runAgent(
  input: AgentRunInput,
  planner: Planner
): Promise<DeterministicResponse<AgentExecutionResult>> {
  const plan = await resolvePlan(input, planner);

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