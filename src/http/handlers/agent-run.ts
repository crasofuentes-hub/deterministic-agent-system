import type { ServerResponse } from "node:http";
import type { JsonObject } from "../../tools";
import { sendJson, sendInvalidRequest, sendInternalError } from "../responses";
import { ERROR_CODES } from "../../core/error-codes";
import { runAgent } from "../../agent-run/run";
import { MockPlanner } from "../../agent-run/planner-mock";
import { DeterministicPlanner } from "../../agent-run/planner-deterministic";
import { DetToolsPlanner } from "../../agent-run/planner-det-tools";
import { LlmMockPlanner } from "../../agent-run/planner-llm-mock";
import type { AgentRunInput } from "../../agent-run/types";

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
    if (planner !== "mock" && planner !== "deterministic" && planner !== "det-tools" && planner !== "det-replan" && planner !== "llm-mock") {
      return { ok: false, message: "planner must be 'mock' or 'deterministic' or 'det-tools' or 'det-replan'" };
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

  return {
    ok: true,
    value: {
      goal,
      demo,
      mode,
      maxSteps,
      planner: typeof planner === "string" ? (planner as AgentRunInput["planner"]) : "deterministic",
      traceId: typeof traceId === "string" ? traceId : undefined,
      sandboxUrl: typeof sandboxUrl === "string" ? sandboxUrl : undefined,
    },
  };
}

export async function handleAgentRun(res: ServerResponse, body: JsonObject): Promise<void> {
  const parsed = parseAgentRunInput(body);
  if (!parsed.ok) {
    sendInvalidRequest(res, "Request validation failed: " + parsed.message);
    return;
  }

  // det-replan: 1 intento + 1 replan determinista (mÃ¡ximo 2 ejecuciones)
  if (parsed.value.planner === "det-replan") {
    const first = await runAgent(
      { ...parsed.value, planner: "det-tools" },
      new DetToolsPlanner()
    );

    if (first.ok) {
      sendJson(res, 200, first);
      return;
    }

    const code = String(first.error?.code ?? "");
    const isToolError =
      code === ERROR_CODES.TOOL_NOT_FOUND ||
      code === ERROR_CODES.TOOL_INVALID_INPUT ||
      code === ERROR_CODES.TOOL_EXECUTION_FAILED;

    if (!isToolError) {
      sendJson(res, 200, first);
      return;
    }

    const msg = "replan:" + code;

    const fallbackPlanner = {
      plan: (_input: any) => ({
        planId: "agent-run-det-replan-v1:" + code,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: String(parsed.value.goal ?? "") },
          { id: "b", kind: "set", key: "errorCode", value: code },
          { id: "c", kind: "append_log", value: msg },
          { id: "d", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "fallback" },
          { id: "e", kind: "append_log", value: "done" }
        ],
      }),
    } as const;

    const second = await runAgent(parsed.value, fallbackPlanner as any);
    sendJson(res, 200, second);
    return;
  }
  try {
    const planner =
      parsed.value.planner === "det-tools"
        ? new DetToolsPlanner()
        : parsed.value.planner === "llm-mock"
          ? new LlmMockPlanner()
          : parsed.value.planner === "mock"
            ? new MockPlanner()
            : new DeterministicPlanner();

    const result = await runAgent(parsed.value, planner);
    sendJson(res, 200, result);
  } catch (_err) {
    // No filtramos detalles internos; payload estable.
    sendInternalError(res);
  }
}