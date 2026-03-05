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

export interface ReplayToolManifestEntry {
  id: string;
  version: number;
}

export interface ReplayManifestV1 {
  nodeVersion: string;
  platform: string;
  arch: string;

  packageName: string;
  packageVersion: string;

  traceSchemaVersion: number;
  tools: ReplayToolManifestEntry[];
}

export interface ReplayBundleV2 {
  schema: "deterministic-agent-system.replay-bundle";
  version: 2;
  planner: ReplayPlannerId;
  input: AgentRunInput;
  resultHashes: ReplayResultHashes;
  manifest: ReplayManifestV1;
}

export type AnyReplayBundle = ReplayBundleV1 | ReplayBundleV2;

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function stableStringifyJson(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t === "string") return JSON.stringify(x);
  if (t === "number") {
    if (!Number.isFinite(x as number)) return JSON.stringify(null);
    return JSON.stringify(x);
  }
  if (t === "boolean") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringifyJson).join(",") + "]";
  if (isObject(x)) {
    const keys = Object.keys(x).sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + stableStringifyJson((x as any)[k])).join(",") +
      "}"
    );
  }
  return "null";
}

export function buildReplayBundleV1(params: {
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

export function buildReplayBundleV2(params: {
  planner: ReplayPlannerId;
  input: AgentRunInput;
  result: AgentExecutionResult;
  manifest: ReplayManifestV1;
}): ReplayBundleV2 {
  return {
    schema: "deterministic-agent-system.replay-bundle",
    version: 2,
    planner: params.planner,
    input: params.input,
    resultHashes: {
      planHash: params.result.planHash,
      executionHash: params.result.executionHash,
      finalTraceLinkHash: params.result.finalTraceLinkHash,
      traceSchemaVersion: params.result.traceSchemaVersion,
    },
    manifest: params.manifest,
  };
}

export function replayBundleToJson(bundle: AnyReplayBundle): string {
  return stableStringifyJson(bundle);
}