import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";

function parseTwoInts(goal: string): { a: number; b: number } | null {
  const m = goal.match(/\b(-?\d+)[^-0-9]+(-?\d+)\b/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return { a, b };
}

/**
 * LLM mock planner:
 * - Determinista (sin RNG, sin timestamps)
 * - Simula "razonamiento" mediante reglas
 * - Produce planes tool-first para que el executor haga el trabajo verificable
 */
export class LlmMockPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    if (intent === "compute") {
      const p = parseTwoInts(goal);
      const a = p ? p.a : 1;
      const b = p ? p.b : 2;

      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          { id: "d", kind: "tool.call", toolId: "math/add", input: { a, b }, outputKey: "sum" },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }

    // default/core: echo a stable "assistant" output
    const msg = "llm-mock:" + intent;
    return {
      planId: "agent-run-llm-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-mock:plan" },
        { id: "d", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "output" },
        { id: "e", kind: "append_log", value: "done" }
      ]
    };
  }
}