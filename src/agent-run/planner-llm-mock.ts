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

function s(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

export class LlmMockPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    const lastErr = s(input.lastErrorCode).trim();

    // Replan logic (deterministic): if we have a TOOL_* failure, degrade to echo with evidence.
    if (lastErr.startsWith("TOOL_")) {
      const msg = "replan2:" + lastErr;
      return {
        planId: "agent-run-llm-mock-replan2-v1:" + intent + ":" + lastErr,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "set", key: "lastErrorCode", value: lastErr },
          { id: "d", kind: "append_log", value: msg },
          { id: "e", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "sum" },
          { id: "f", kind: "append_log", value: "done" }
        ]
      };
    }

    // Deterministic negative-path trigger: if goal includes "missingtool", simulate a "bad tool selection"
    if (goal.includes("missingtool")) {
      return {
        planId: "agent-run-llm-mock-v1:" + intent + ":missingtool",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          { id: "d", kind: "tool.call", toolId: "nope/tool", input: { x: 1 }, outputKey: "out" },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }

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