import type { DeterministicAgentPlan } from "../agent/plan-types";
import { canonicalizePlan } from "../agent/canonical-plan";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";
import { computeLlmLiveCacheKey, loadCachedPlan, saveCachedPlan } from "./llm-live-cache";

function parseTwoInts(goal: string): { a: number; b: number } | null {
  const m = goal.match(/\b(-?\d+)[^-0-9]+(-?\d+)\b/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return { a, b };
}

function providerFromInput(input: AgentRunInput): "mock" | "openai-compatible" {
  const p = typeof input.llmProvider === "string" ? input.llmProvider : "mock";
  return p === "openai-compatible" ? "openai-compatible" : "mock";
}

export function parseDeterministicPlanFromModelText(text: string): DeterministicAgentPlan {
  try {
    const parsed = JSON.parse(String(text ?? ""));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Plan text must decode to an object");
    }
    return canonicalizePlan(parsed as DeterministicAgentPlan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error("llm_live_invalid_plan_text: " + message);
  }
}

function buildPlanViaMockProvider(input: AgentRunInput): DeterministicAgentPlan {
  const goal = normalizeGoal(input.goal);
  const intent = deriveIntent(goal);

  if (intent === "compute") {
    const p = parseTwoInts(goal);
    const a = p ? p.a : 1;
    const b = p ? p.b : 2;
    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        { id: "d", kind: "tool.call", toolId: "math/add", input: { a, b }, outputKey: "sum" },
        { id: "e", kind: "append_log", value: "done" }
      ]
    };
  }

  const msg = "llm-live:" + intent;
  return {
    planId: "agent-run-llm-live-mock-v1:" + intent,
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "goal", value: goal },
      { id: "b", kind: "set", key: "intent", value: intent },
      { id: "c", kind: "append_log", value: "llm-live:planned" },
      { id: "d", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "output" },
      { id: "e", kind: "append_log", value: "done" }
    ]
  };
}

export class LlmLivePlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const provider = providerFromInput(input);

    const keyObj = {
      planner: "llm-live",
      provider,
      model: input.llmModel ?? "",
      temperature: typeof input.llmTemperature === "number" ? input.llmTemperature : null,
      maxTokens: typeof input.llmMaxTokens === "number" ? input.llmMaxTokens : null,
      goal: String(input.goal ?? ""),
      demo: input.demo,
      history: Array.isArray((input as any).history) ? (input as any).history : [],
      lastErrorCode: typeof (input as any).lastErrorCode === "string" ? (input as any).lastErrorCode : "",
      llmPlanText: typeof input.llmPlanText === "string" ? input.llmPlanText : ""
    };

    const { keyHash } = computeLlmLiveCacheKey(keyObj);
    const cacheDir = ".llm-live-cache";

    const cached = loadCachedPlan(cacheDir, keyHash);
    if (cached) return cached;

    if (provider === "openai-compatible") {
      const planText = typeof input.llmPlanText === "string" ? input.llmPlanText : "";
      if (planText.trim().length === 0) {
        throw new Error("llm_live_not_configured");
      }

      const plan = parseDeterministicPlanFromModelText(planText);
      saveCachedPlan(cacheDir, keyHash, plan);
      return plan;
    }

    const plan = buildPlanViaMockProvider(input);
    saveCachedPlan(cacheDir, keyHash, plan);
    return plan;
  }
}