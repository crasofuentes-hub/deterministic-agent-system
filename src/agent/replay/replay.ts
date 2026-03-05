import { runAgent } from "../../agent-run/run";
import type { AgentRunInput, Planner } from "../../agent-run/types";
import { MockPlanner } from "../../agent-run/planner-mock";
import { DeterministicPlanner } from "../../agent-run/planner-deterministic";
import { DetToolsPlanner } from "../../agent-run/planner-det-tools";
import { LlmMockPlanner } from "../../agent-run/planner-llm-mock";
import type { DeterministicResponse } from "../../core/contracts";
import type { AgentExecutionResult } from "../plan-types";
import { ERROR_CODES } from "../../core/error-codes";
import type { ReplayBundleV1, ReplayPlannerId } from "./bundle";

function makePlanner(id: ReplayPlannerId): Planner {
  if (id === "mock") return new MockPlanner();
  if (id === "det-tools") return new DetToolsPlanner();
  if (id === "llm-mock") return new LlmMockPlanner();
  if (id === "deterministic") return new DeterministicPlanner();

  // det-replan vive en el handler HTTP; para replay usamos fallback deterministic
  // (la replanificación se verifica vía test HTTP ya existente)
  return new DeterministicPlanner();
}

export interface ReplayVerification {
  ok: boolean;
  mismatches?: {
    planHash?: { expected: string; actual: string };
    executionHash?: { expected: string; actual: string };
    finalTraceLinkHash?: { expected: string; actual: string };
    traceSchemaVersion?: { expected: number; actual: number };
  };
  error?: { code: string; message: string };
}

export async function executeForReplay(input: AgentRunInput, planner: ReplayPlannerId): Promise<DeterministicResponse<AgentExecutionResult>> {
  const p = makePlanner(planner);
  return await runAgent(input, p);
}

export async function verifyReplayBundle(bundle: ReplayBundleV1): Promise<ReplayVerification> {
  const input: AgentRunInput = bundle.input;
  const planner: ReplayPlannerId = bundle.planner;

  const r = await executeForReplay(input, planner);
  if (!r.ok) {
    return {
      ok: false,
      error: {
        code: r.error.code ?? ERROR_CODES.INTERNAL_ERROR,
        message: r.error.message ?? "replay execution failed",
      },
    };
  }

  const expected = bundle.resultHashes;
  const actual = r.result;

  const mismatches: ReplayVerification["mismatches"] = {};
  if (actual.planHash !== expected.planHash) mismatches.planHash = { expected: expected.planHash, actual: actual.planHash };
  if (actual.executionHash !== expected.executionHash) mismatches.executionHash = { expected: expected.executionHash, actual: actual.executionHash };
  if (actual.finalTraceLinkHash !== expected.finalTraceLinkHash) mismatches.finalTraceLinkHash = { expected: expected.finalTraceLinkHash, actual: actual.finalTraceLinkHash };
  if (actual.traceSchemaVersion !== expected.traceSchemaVersion) mismatches.traceSchemaVersion = { expected: expected.traceSchemaVersion, actual: actual.traceSchemaVersion };

  const ok = Object.keys(mismatches).length === 0;
  return ok ? { ok: true } : { ok: false, mismatches };
}