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
 * Nota: aquí NO usamos hash crypto; mantenemos determinismo puro sin depender de utilidades externas.
 * El intent es una clasificación simple y extensible.
 */
export function deriveIntent(goal: string): string {
  const g = normalizeGoal(goal);

  if (g.includes("sandbox") || g.includes("browser") || g.includes("web")) return "sandbox";
  if (g.includes("sum") || g.includes("add") || g.includes("math")) return "compute";
  if (g.includes("extract") || g.includes("parse")) return "extract";
  return "core";
}

/**
 * Construye un plan determinístico a partir del input.
 * - planId estable (depende de demo + intent; NO incluye timestamps)
 * - pasos simples, extensibles
 */
export function buildPlanFromGoal(input: AgentRunInput): DeterministicAgentPlan {
  const goal = normalizeGoal(input.goal);
  const intent = deriveIntent(goal);

  if (input.demo === "sandbox") {
    // El planner/handler puede decidir el URL de fixture; aquí no lo asumimos.
    // Se espera que planners concretos reemplacen/inyecten url según entorno.
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