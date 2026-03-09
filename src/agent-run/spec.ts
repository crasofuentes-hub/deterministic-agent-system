import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput } from "./types";

/**
 * Normaliza texto para determinismo:
 * - String()
 * - Unicode NFC
 * - trim
 * - lowercase (locale-agnostic)
 */
export function normalizeGoal(goal: string): string {
  return String(goal).normalize("NFC").trim().toLowerCase();
}

/**
 * Deriva un "intent" estable a partir del goal.
 */
export function deriveIntent(goal: string): string {
  const g = normalizeGoal(goal);

  if (g.includes("sandbox") || g.includes("browser") || g.includes("web")) return "sandbox";
  if (g.includes("sum") || g.includes("add") || g.includes("math")) return "compute";

  if (g.includes("extract chain") || g.includes("extract normalized")) return "extract-chain";

  const mentionsNormalize = g.includes("normalize") || g.includes("clean");
  const mentionsExtract = g.includes("extract") || g.includes("parse");
  const mentionsSelect = g.includes("select") || g.includes("pick keys");
  const mentionsMerge = g.includes("merge") || g.includes("combine");

  const isSpecialExtractMerge =
    (g.includes("extract merge") || g.includes("extract and merge")) &&
    !mentionsNormalize &&
    !mentionsSelect;

  if (isSpecialExtractMerge) return "extract-merge";

  if (mentionsNormalize || mentionsExtract || mentionsSelect || mentionsMerge) {
    const count =
      (mentionsNormalize ? 1 : 0) +
      (mentionsExtract ? 1 : 0) +
      (mentionsSelect ? 1 : 0) +
      (mentionsMerge ? 1 : 0);

    if (count >= 2) return "cap-synth";
    if (mentionsSelect) return "cap-synth";
    if (mentionsMerge) return "cap-synth";
    if (mentionsExtract) return "extract";
    if (mentionsNormalize) return "normalize";
  }

  return "core";
}

/**
 * Construye un plan determinÃƒÂ­stico a partir del input.
 */
export function buildPlanFromGoal(input: AgentRunInput): DeterministicAgentPlan {
  const goal = normalizeGoal(input.goal);
  const intent = deriveIntent(goal);

  if (input.demo === "sandbox") {
    return {
      planId: "agent-run-sandbox-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "planned" }
      ]
    };
  }

  return {
    planId: "agent-run-core-v1:" + intent,
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "goal", value: goal },
      { id: "b", kind: "set", key: "intent", value: intent },
      { id: "c", kind: "increment", key: "n", value: 1 },
      { id: "d", kind: "append_log", value: "planned" }
    ]
  };
}