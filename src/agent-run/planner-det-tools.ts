import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";

export class DetToolsPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    // Plan tool-based mínimo y estable (Phase B1): ids fijos y entrada canonicalizable.
    return {
      planId: "agent-run-det-tools-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "tool.call", toolId: "math/add", input: { a: 1, b: 2 }, outputKey: "sum" },
        { id: "d", kind: "tool.call", toolId: "echo", input: { value: "sum" }, outputKey: "echoed" },
        { id: "e", kind: "append_log", value: "planned" }
      ]
    };
  }
}