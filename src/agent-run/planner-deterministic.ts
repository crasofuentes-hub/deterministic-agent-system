import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { buildPlanFromGoal } from "./spec";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Planner determinístico (NO LLM):
 * - Normaliza goal + deriva intent vía spec.ts
 * - Produce planId estable (sin timestamps)
 * - Para demo sandbox: inyecta URL fixture server de forma estable
 */
export class DeterministicPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const base = buildPlanFromGoal(input);

    if (input.demo !== "sandbox") {
      return base;
    }

    // Fixture server local (determinista por configuración, no por entorno)
    const sandboxUrl = "http://127.0.0.1:4319/";

    // Convertimos el plan base "sandbox" en uno ejecutable por el sandbox runner.
    // Nota: mantenemos ids estables y orden fijo.
    return {
      planId: base.planId,
      version: 1,
      steps: [
        { id: "a", kind: "sandbox.open", sessionId: "s1", url: sandboxUrl },
        { id: "b", kind: "sandbox.extract", sessionId: "s1", selector: "#title", outputKey: "title" },
        { id: "c", kind: "append_log", value: "done" },
      ],
    };
  }
}