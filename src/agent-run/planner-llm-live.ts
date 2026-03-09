import type { DeterministicAgentPlan } from "../agent/plan-types";
import { canonicalizePlan } from "../agent/canonical-plan";
import type { AgentRunInput, Planner, AsyncPlanner } from "./types";
import type { AsyncModelAdapter } from "../integrations/provider-types";
import { createModelAdapterSelection } from "../integrations";
import { normalizeGoal, deriveIntent } from "./spec";
import { resolveToolIdForCapability } from "../agent/tools";
import { computeLlmLiveCacheKey, loadCachedPlan, saveCachedPlan } from "./llm-live-cache";
import { synthesizeCapabilitiesFromGoal } from "./capability-synthesis";

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

function computeKey(input: AgentRunInput): { keyHash: string; cacheDir: string } {
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
  return { keyHash, cacheDir: ".llm-live-cache" };
}

function buildLlmLivePrompt(input: AgentRunInput): string {
  const goal = normalizeGoal(input.goal);
  const intent = deriveIntent(goal);

  return [
    "Return ONLY valid JSON for a DeterministicAgentPlan.",
    "No markdown. No prose. No code fences.",
    "Schema keys: planId, version, steps.",
    "version must be 1.",
    "Use stable step ids and deterministic content.",
    "Goal: " + goal,
    "Intent: " + intent,
    "Demo: " + input.demo
  ].join("\n");
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

export async function buildPlanViaOpenAICompatibleAdapter(
  input: AgentRunInput,
  adapter: AsyncModelAdapter
): Promise<DeterministicAgentPlan> {
  const response = await adapter.generateAsync({
    prompt: buildLlmLivePrompt(input),
    maxTokens:
      typeof input.llmMaxTokens === "number" && Number.isFinite(input.llmMaxTokens)
        ? Math.floor(input.llmMaxTokens)
        : 256,
    temperature:
      typeof input.llmTemperature === "number" && Number.isFinite(input.llmTemperature)
        ? input.llmTemperature
        : 0,
  });

  return parseDeterministicPlanFromModelText(response.text);
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

  if (intent === "normalize") {
    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        {
          id: "d",
          kind: "tool.call",
          toolId: "text/normalize",
          input: {
            text: goal,
            trim: true,
            lowercase: true,
            collapseWhitespace: true
          },
          outputKey: "normalized"
        },
        { id: "e", kind: "append_log", value: "done" }
      ]
    };
  }

  if (intent === "extract") {
    const path =
      goal.includes("name") ? "user.name" :
      goal.includes("role") ? "user.role" :
      "items.0.id";

    const text = JSON.stringify({
      user: { name: "Oscar", role: "inventor" },
      items: [{ id: "a1" }, { id: "b2" }]
    });

    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        {
          id: "d",
          kind: "tool.call",
          toolId: "json/extract",
          input: { text, path },
          outputKey: "extracted"
        },
        { id: "e", kind: "append_log", value: "done" }
      ]
    };
  }
  if (intent === "cap-synth") {
    const caps = synthesizeCapabilitiesFromGoal(goal);
    const toolIds = caps.map((cap) => resolveToolIdForCapability(cap));
    const extraJson = JSON.stringify({ source: "llm-live", workflow: "cap-synth" });

    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        {
          id: "d",
          kind: "tool.call",
          toolId: toolIds[0],
          input: {
            text: '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } }  ',
            trim: true,
            lowercase: false,
            collapseWhitespace: true
          },
          outputKey: "normalizedJson"
        },
        {
          id: "e",
          kind: "tool.call",
          toolId: toolIds[1],
          input: {
            text: { "$ref": "state.values.normalizedJson.text" },
            path: "user"
          },
          outputKey: "extractedUser"
        },
        {
          id: "f",
          kind: "tool.call",
          toolId: toolIds[2],
          input: {
            left: { "$ref": "state.values.extractedUser.value" },
            right: extraJson
          },
          outputKey: "merged"
        },
        { id: "g", kind: "append_log", value: "done" }
      ]
    };
  }


  if (intent === "extract-merge") {
    const rawJson = '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } , "meta" : { "ok" : true } }  ';
    const normalizeToolId = resolveToolIdForCapability("text.normalize");
    const extractToolId = resolveToolIdForCapability("json.extract");
    const mergeToolId = resolveToolIdForCapability("json.merge");
    const extraJson = JSON.stringify({ source: "llm-live", workflow: "extract-merge" });

    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        {
          id: "d",
          kind: "tool.call",
          toolId: normalizeToolId,
          input: {
            text: rawJson,
            trim: true,
            lowercase: false,
            collapseWhitespace: true
          },
          outputKey: "normalizedJson"
        },
        {
          id: "e",
          kind: "tool.call",
          toolId: extractToolId,
          input: {
            text: { "$ref": "state.values.normalizedJson.text" },
            path: "user"
          },
          outputKey: "extractedUser"
        },
        {
          id: "f",
          kind: "tool.call",
          toolId: mergeToolId,
          input: {
            left: { "$ref": "state.values.extractedUser.value" },
            right: extraJson
          },
          outputKey: "merged"
        },
        { id: "g", kind: "append_log", value: "done" }
      ]
    };
  }

  if (intent === "extract-chain") {
    const rawJson = '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } , "items" : [ { "id" : "a1" } , { "id" : "b2" } ] }  ';
    const path = goal.includes("role") ? "user.role" : "user.name";

    return {
      planId: "agent-run-llm-live-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        {
          id: "d",
          kind: "tool.call",
          toolId: "text/normalize",
          input: {
            text: rawJson,
            trim: true,
            lowercase: false,
            collapseWhitespace: true
          },
          outputKey: "normalizedJson"
        },
        {
          id: "e",
          kind: "tool.call",
          toolId: "json/extract",
          input: {
            text: { "$ref": "state.values.normalizedJson.text" },
            path
          },
          outputKey: "extracted"
        },
        { id: "f", kind: "append_log", value: "done" }
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

function buildPlanViaStubText(input: AgentRunInput): DeterministicAgentPlan {
  const planText = typeof input.llmPlanText === "string" ? input.llmPlanText : "";
  if (planText.trim().length === 0) {
    throw new Error("llm_live_not_configured");
  }
  return parseDeterministicPlanFromModelText(planText);
}

function createOpenAICompatibleAdapterFromEnv(input: AgentRunInput): AsyncModelAdapter | undefined {
  const baseUrl = String(process.env.DAS_OPENAI_COMPAT_BASE_URL ?? "").trim();
  const apiKey = String(process.env.DAS_OPENAI_COMPAT_API_KEY ?? "").trim();
  const model = String(input.llmModel ?? process.env.DAS_OPENAI_COMPAT_MODEL ?? "").trim();

  if (baseUrl.length === 0 || apiKey.length === 0 || model.length === 0) {
    return undefined;
  }

  const selection = createModelAdapterSelection({
    provider: "openai-compatible",
    openaiCompatible: {
      baseUrl,
      apiKey,
      model,
      defaultTemperature:
        typeof input.llmTemperature === "number" && Number.isFinite(input.llmTemperature)
          ? input.llmTemperature
          : 0,
    },
  });

  return selection.asyncAdapter;
}

export class LlmLivePlanner implements Planner, AsyncPlanner {
  private readonly asyncAdapter?: AsyncModelAdapter;

  public constructor(asyncAdapter?: AsyncModelAdapter) {
    this.asyncAdapter = asyncAdapter;
  }

  plan(input: AgentRunInput): DeterministicAgentPlan {
    const provider = providerFromInput(input);
    const { keyHash, cacheDir } = computeKey(input);

    const cached = loadCachedPlan(cacheDir, keyHash);
    if (cached) return cached;

    if (provider === "openai-compatible") {
      if (typeof input.llmPlanText === "string" && input.llmPlanText.trim().length > 0) {
        const plan = buildPlanViaStubText(input);
        saveCachedPlan(cacheDir, keyHash, plan);
        return plan;
      }
      throw new Error("llm_live_requires_async_planner");
    }

    const plan = buildPlanViaMockProvider(input);
    saveCachedPlan(cacheDir, keyHash, plan);
    return plan;
  }

  async planAsync(input: AgentRunInput): Promise<DeterministicAgentPlan> {
    const provider = providerFromInput(input);
    const { keyHash, cacheDir } = computeKey(input);

    const cached = loadCachedPlan(cacheDir, keyHash);
    if (cached) return cached;

    if (provider === "openai-compatible") {
      if (typeof input.llmPlanText === "string" && input.llmPlanText.trim().length > 0) {
        const plan = buildPlanViaStubText(input);
        saveCachedPlan(cacheDir, keyHash, plan);
        return plan;
      }

      const adapter = this.asyncAdapter ?? createOpenAICompatibleAdapterFromEnv(input);
      if (!adapter) {
        throw new Error("llm_live_not_configured");
      }

      const plan = await buildPlanViaOpenAICompatibleAdapter(input, adapter);
      saveCachedPlan(cacheDir, keyHash, plan);
      return plan;
    }

    const plan = buildPlanViaMockProvider(input);
    saveCachedPlan(cacheDir, keyHash, plan);
    return plan;
  }
}