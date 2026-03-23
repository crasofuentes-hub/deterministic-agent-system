import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";
import { synthesizeCapabilitiesFromGoal } from "./capability-synthesis";
import { buildCapabilitySynthPlan } from "./capability-pipeline";

function parseTwoIntsFromGoal(goal: string): { a: number; b: number } | null {
  const m = goal.match(/\b(?:add|sum|math)\b[^-0-9]*(-?\d+)[^-0-9]+(-?\d+)\b/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return { a, b };
}

function wantsLoop(goal: string): boolean {
  return goal.includes("loop") || goal.includes("repeat");
}

export class DetToolsPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    const parsed = parseTwoIntsFromGoal(goal);
    const a = parsed ? parsed.a : 1;
    const b = parsed ? parsed.b : 2;

    if (goal.includes("missingtool")) {
      return {
        planId: "agent-run-det-tools-neg-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "tool.call", toolId: "nope/tool", input: { x: 1 }, outputKey: "out" }
        ]
      };
    }

    if (wantsLoop(goal)) {
      return {
        planId: "agent-run-det-tools-loop-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "tool.loop", toolId: "math/add", input: { a, b }, outputKey: "sum", maxIterations: 10 },
          { id: "d", kind: "append_log", value: "planned" }
        ]
      };
    }

    if (intent === "cap-synth") {
      const capabilities = synthesizeCapabilitiesFromGoal(goal);
      return buildCapabilitySynthPlan({
        plannerPrefix: "det-tools",
        goal,
        intent,
        capabilities,
      });
    }

    return {
      planId: "agent-run-det-tools-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "tool.call", toolId: "math/add", input: { a, b }, outputKey: "sum" },
        { id: "d", kind: "append_log", value: "planned" }
      ]
    };
  }
}