import type { AgentExecutionResult } from "../plan-types";
import type { AgentRunInput } from "../../agent-run/types";

export type ReplayPlannerId = "mock" | "deterministic" | "det-tools" | "det-replan" | "llm-mock";

export interface ReplayResultHashes {
  planHash: string;
  executionHash: string;
  finalTraceLinkHash: string;
  traceSchemaVersion: number;
}

export interface ReplayBundleV1 {
  schema: "deterministic-agent-system.replay-bundle";
  version: 1;
  planner: ReplayPlannerId;
  input: AgentRunInput;
  resultHashes: ReplayResultHashes;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function stableStringifyJson(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t === "string") return JSON.stringify(x);
  if (t === "number") {
    if (!Number.isFinite(x as number)) return JSON.stringify(null);
    // JSON.stringify mantiene formato estable para numbers finitos
    return JSON.stringify(x);
  }
  if (t === "boolean") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringifyJson).join(",") + "]";
  if (isObject(x)) {
    const keys = Object.keys(x).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringifyJson((x as any)[k])).join(",") + "}";
  }
  // undefined / function / symbol -> null
  return "null";
}

export function buildReplayBundle(params: {
  planner: ReplayPlannerId;
  input: AgentRunInput;
  result: AgentExecutionResult;
}): ReplayBundleV1 {
  return {
    schema: "deterministic-agent-system.replay-bundle",
    version: 1,
    planner: params.planner,
    input: params.input,
    resultHashes: {
      planHash: params.result.planHash,
      executionHash: params.result.executionHash,
      finalTraceLinkHash: params.result.finalTraceLinkHash,
      traceSchemaVersion: params.result.traceSchemaVersion,
    },
  };
}

export function replayBundleToJson(bundle: ReplayBundleV1): string {
  // JSON determinista (keys ordenadas)
  return stableStringifyJson(bundle);
}