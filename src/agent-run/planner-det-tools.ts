import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";

function parseTwoIntsFromGoal(goal: string): { a: number; b: number } | null {
  // Determinista: regex simple, no locale, solo enteros con signo opcional.
  // Ejemplos válidos: "add 2 3", "sum -10 7", "math add 1 2"
  const m = goal.match(/\b(?:add|sum|math)\b[^-0-9]*(-?\d+)[^-0-9]+(-?\d+)\b/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;

  return { a, b };
}

export class DetToolsPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    const parsed = parseTwoIntsFromGoal(goal);
    const a = parsed ? parsed.a : 1;
    const b = parsed ? parsed.b : 2;

    return {
      planId: "agent-run-det-tools-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },

        // Output a state.values["sum"] como string JSON determinista via stableStringifyJson() del executor.
        { id: "c", kind: "tool.call", toolId: "math/add", input: { a, b }, outputKey: "sum" },

        { id: "d", kind: "append_log", value: "planned" }
      ]
    };
  }
}