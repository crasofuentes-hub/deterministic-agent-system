import type { AgentState, AgentStep } from "./plan-types";

export function createInitialAgentState(): AgentState {
  return {
    counters: {},
    values: {},
    logs: [],
  };
}

function stableStateHashLike(state: AgentState): string {
  const sortedCounters: Record<string, number> = {};
  for (const k of Object.keys(state.counters).sort()) {
    const v = state.counters[k];
    if (typeof v === "number") {
      sortedCounters[k] = v;
    }
  }

  const sortedValues: Record<string, string> = {};
  for (const k of Object.keys(state.values).sort()) {
    const v = state.values[k];
    if (typeof v === "string") {
      sortedValues[k] = v;
    }
  }

  const canonical = JSON.stringify({
    counters: sortedCounters,
    values: sortedValues,
    logs: state.logs.slice(),
  });

  let hash = 2166136261 >>> 0;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return "h" + hash.toString(16).padStart(8, "0");
}

export function getStateHashLike(state: AgentState): string {
  return stableStateHashLike(state);
}

export function applyMockStep(state: AgentState, step: AgentStep): AgentState {
  const next: AgentState = {
    counters: { ...state.counters },
    values: { ...state.values },
    logs: state.logs.slice(),
  };

  if (step.kind === "set") {
    next.values[String(step.key)] = String(step.value);
    return next;
  }

  if (step.kind === "increment") {
    const key = String(step.key);
    const delta = Number(step.value);
    const prev = typeof next.counters[key] === "number" ? next.counters[key] : 0;
    next.counters[key] = prev + delta;
    return next;
  }

  if (step.kind === "append_log") {
    next.logs.push(String(step.value));
    return next;
  }

  return next;
}