import type { AgentStep, AgentState } from "./plan-types";
import { prefixedSha256 } from "./crypto-hash";

export const TRACE_SCHEMA_VERSION = 1 as const;

function stableStateView(state: AgentState): string {
  const counters: Record<string, number> = {};
  for (const k of Object.keys(state.counters).sort()) {
    const v = state.counters[k];
    if (typeof v === "number" && Number.isFinite(v) && Number.isSafeInteger(v)) {
      counters[k] = v;
    }
  }

  const values: Record<string, string> = {};
  for (const k of Object.keys(state.values).sort()) {
    const v = state.values[k];
    if (typeof v === "string") {
      values[k] = v.normalize("NFC");
    }
  }

  const logs = state.logs.map((x) => String(x).normalize("NFC"));

  return JSON.stringify({
    counters,
    values,
    logs,
  });
}

function stableStepView(step: AgentStep): string {
  const base: any = {
    id: step.id.normalize("NFC"),
    kind: step.kind,
    key: typeof step.key === "undefined" ? null : step.key.normalize("NFC"),
    value:
      typeof step.value === "undefined"
        ? null
        : typeof step.value === "string"
          ? step.value.normalize("NFC")
          : step.value,
  };

  // Solo incluir sandbox fields cuando aplican (no romper hashes legacy).
  const isSandbox = typeof step.kind === "string" && step.kind.startsWith("sandbox.");
  if (isSandbox) {
    base.sessionId = typeof step.sessionId === "string" ? step.sessionId.normalize("NFC") : null;
    base.url = typeof step.url === "string" ? step.url.normalize("NFC") : null;
    base.selector = typeof step.selector === "string" ? step.selector.normalize("NFC") : null;
    base.text = typeof step.text === "string" ? step.text.normalize("NFC") : null;
    base.outputKey = typeof step.outputKey === "string" ? step.outputKey.normalize("NFC") : null;
  }

  return JSON.stringify(base);
}

export function computeTraceLinkHash(params: {
  previousLinkHash: string;
  stepIndex: number;
  step: AgentStep;
  beforeHashLike: string;
  afterHashLike: string;
  beforeState: AgentState;
  afterState: AgentState;
}): string {
  const payload = JSON.stringify({
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    previousLinkHash: params.previousLinkHash,
    stepIndex: params.stepIndex,
    step: JSON.parse(stableStepView(params.step)),
    beforeHashLike: params.beforeHashLike,
    afterHashLike: params.afterHashLike,
    beforeState: JSON.parse(stableStateView(params.beforeState)),
    afterState: JSON.parse(stableStateView(params.afterState)),
  });

  return prefixedSha256("tl", payload);
}

export function computeExecutionHash(params: {
  planHash: string;
  stepCount: number;
  finalState: AgentState;
  finalTraceLinkHash: string;
}): string {
  const payload = JSON.stringify({
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    planHash: params.planHash,
    stepCount: params.stepCount,
    finalTraceLinkHash: params.finalTraceLinkHash,
    finalState: JSON.parse(stableStateView(params.finalState)),
  });

  return prefixedSha256("eh", payload);
}

