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
 * Nota: aquÃƒÂ­ NO usamos hash crypto; mantenemos determinismo puro sin depender de utilidades externas.
 * El intent es una clasificaciÃƒÂ³n simple y extensible.
 */
export function deriveIntent(goal: string): string {
  const g = normalizeGoal(goal);

  if (g.includes("sandbox") || g.includes("browser") || g.includes("web")) return "sandbox";
  if (g.includes("sum") || g.includes("add") || g.includes("math")) return "compute";
  if (g.includes("extract chain") || g.includes("extract normalized")) return "extract-chain";
  if (g.includes("extract") || g.includes("parse")) return "extract";
  if (g.includes("normalize") || g.includes("clean")) return "normalize";
  return "core";
}

/**
 * Construye un plan determinÃƒÂ­stico a partir del input.
 * - planId estable (depende de demo + intent; NO incluye timestamps)
 * - pasos simples, extensibles
 */
export function buildPlanFromGoal(input: AgentRunInput): DeterministicAgentPlan {
  const goal = normalizeGoal(input.goal);
  const intent = deriveIntent(goal);

  if (input.demo === "sandbox") {
    // El planner/handler puede decidir el URL de fixture; aquÃƒÂ­ no lo asumimos.
    // Se espera que planners concretos reemplacen/inyecten url segÃƒÂºn entorno.
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