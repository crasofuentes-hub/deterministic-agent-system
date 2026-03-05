import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { DeterministicAgentPlan } from "../agent/plan-types";
import { stableStringifyJson } from "../agent/replay/bundle";

export interface LlmLiveCacheRecordV1 {
  schema: "deterministic-agent-system.llm-live-cache";
  version: 1;
  keyHash: string;
  plan: DeterministicAgentPlan;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function computeLlmLiveCacheKey(input: unknown): { keyJson: string; keyHash: string } {
  const keyJson = stableStringifyJson(input);
  return { keyJson, keyHash: sha256Hex(keyJson) };
}

export function loadCachedPlan(cacheDir: string, keyHash: string): DeterministicAgentPlan | undefined {
  const path = join(cacheDir, keyHash + ".json");
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf8");
  const j = JSON.parse(raw) as LlmLiveCacheRecordV1;
  if (!j || j.schema !== "deterministic-agent-system.llm-live-cache" || j.version !== 1) return undefined;
  if (j.keyHash !== keyHash) return undefined;
  return j.plan;
}

export function saveCachedPlan(cacheDir: string, keyHash: string, plan: DeterministicAgentPlan): void {
  mkdirSync(cacheDir, { recursive: true });
  const rec: LlmLiveCacheRecordV1 = {
    schema: "deterministic-agent-system.llm-live-cache",
    version: 1,
    keyHash,
    plan,
  };
  const json = stableStringifyJson(rec) + "\n";
  const finalPath = join(cacheDir, keyHash + ".json");
  const tmpPath = join(cacheDir, keyHash + ".tmp");
  writeFileSync(tmpPath, json, { encoding: "utf8" });
  renameSync(tmpPath, finalPath); // atomic on same volume
}