import type { ServerResponse } from "node:http";
import type { JsonObject } from "../../tools";
import { sendJson, sendInvalidRequest, sendInternalError } from "../responses";
import { runAgent } from "../../agent-run/run";
import { MockPlanner } from "../../agent-run/planner-mock";
import { DeterministicPlanner } from "../../agent-run/planner-deterministic";
import { DetToolsPlanner } from "../../agent-run/planner-det-tools";
import { LlmMockPlanner } from "../../agent-run/planner-llm-mock";
import { LlmLivePlanner } from "../../agent-run/planner-llm-live";
import type { AgentRunInput, Planner } from "../../agent-run/types";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAgentRunInput(body: unknown): { ok: true; value: AgentRunInput } | { ok: false; message: string } {
  if (!isObject(body)) return { ok: false, message: "Request body must be a JSON object" };

  const goal = body.goal;
  if (!isNonEmptyString(goal)) return { ok: false, message: "goal must be a non-empty string" };

  const demo = body.demo;
  if (demo !== "core" && demo !== "sandbox") return { ok: false, message: "demo must be 'core' or 'sandbox'" };

  const mode = body.mode;
  if (mode !== "mock" && mode !== "local") return { ok: false, message: "mode must be 'mock' or 'local'" };

  const maxSteps = body.maxSteps;
  if (typeof maxSteps !== "number" || !Number.isInteger(maxSteps) || maxSteps <= 0) {
    return { ok: false, message: "maxSteps must be a positive integer" };
  }

  const planner = body.planner;
  if (typeof planner !== "undefined") {
    if (
      planner !== "mock" &&
      planner !== "deterministic" &&
      planner !== "det-tools" &&
      planner !== "det-replan" &&
      planner !== "det-replan2" &&
      planner !== "llm-mock" &&
      planner !== "llm-live"
    ) {
      return {
        ok: false,
        message:
          "planner must be 'mock' or 'deterministic' or 'det-tools' or 'det-replan' or 'det-replan2' or 'llm-mock' or 'llm-live'",
      };
    }
  }

  const traceId = body.traceId;
  if (typeof traceId !== "undefined") {
    if (!isNonEmptyString(traceId)) return { ok: false, message: "traceId must be a non-empty string when provided" };
    if (traceId.length > 256) return { ok: false, message: "traceId exceeds 256 characters" };
  }

  const sandboxUrl = body.sandboxUrl;
  if (typeof sandboxUrl !== "undefined") {
    if (!isNonEmptyString(sandboxUrl)) return { ok: false, message: "sandboxUrl must be a non-empty string when provided" };
    if (!sandboxUrl.startsWith("http://") && !sandboxUrl.startsWith("https://")) {
      return { ok: false, message: "sandboxUrl must start with http:// or https://" };
    }
    if (sandboxUrl.length > 2048) return { ok: false, message: "sandboxUrl exceeds 2048 characters" };
  }

  // Optional replan context
  const history = body.history;
  const lastErrorCode = body.lastErrorCode;

  // Optional LLM config
  const llmProvider = body.llmProvider;
  const llmModel = body.llmModel;
  const llmTemperature = body.llmTemperature;
  const llmMaxTokens = body.llmMaxTokens;

  return {
    ok: true,
    value: {
      goal,
      demo,
      mode,
      maxSteps,
      planner: typeof planner === "string" ? (planner as any) : "deterministic",
      traceId: typeof traceId === "string" ? traceId : undefined,
      sandboxUrl: typeof sandboxUrl === "string" ? sandboxUrl : undefined,
      history: Array.isArray(history) ? (history as any) : undefined,
      lastErrorCode: typeof lastErrorCode === "string" ? lastErrorCode : undefined,
      llmProvider: typeof llmProvider === "string" ? (llmProvider as any) : undefined,
      llmModel: typeof llmModel === "string" ? llmModel : undefined,
      llmTemperature: typeof llmTemperature === "number" ? llmTemperature : undefined,
      llmMaxTokens: typeof llmMaxTokens === "number" ? llmMaxTokens : undefined,
    },
  };
}

function selectPlanner(plannerId: string | undefined): Planner {
  if (plannerId === "det-tools") return new DetToolsPlanner();
  if (plannerId === "llm-live") return new LlmLivePlanner();
  if (plannerId === "llm-mock") return new LlmMockPlanner();
  if (plannerId === "mock") return new MockPlanner();
  return new DeterministicPlanner();
}

export async function handleAgentRun(res: ServerResponse, body: JsonObject): Promise<void> {
  const parsed = parseAgentRunInput(body);
  if (!parsed.ok) {
    sendInvalidRequest(res, "Request validation failed: " + parsed.message);
    return;
  }

  try {
    const planner = selectPlanner(parsed.value.planner);
    const result = await runAgent(parsed.value, planner);
    sendJson(res, 200, result);
  } catch (_err) {
    sendInternalError(res);
  }
}