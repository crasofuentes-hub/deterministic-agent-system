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

function s(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

export function applyMockStep(state: AgentState, step: AgentStep): AgentState {
  const next: AgentState = {
    counters: { ...state.counters },
    values: { ...state.values },
    logs: state.logs.slice(),
  };

  if (step.kind === "set") {
    next.values[s(step.key)] = s(step.value);
    return next;
  }

  if (step.kind === "increment") {
    const key = s(step.key);
    const delta = Number(step.value);
    const prev = typeof next.counters[key] === "number" ? next.counters[key] : 0;
    next.counters[key] = prev + delta;
    return next;
  }

  if (step.kind === "append_log") {
    next.logs.push(s(step.value));
    return next;
  }

  // --- Enterprise sandbox steps (deterministic mock execution) ---
  if (step.kind === "sandbox.open") {
    const sessionId = s(step.sessionId);
    const url = s(step.url);
    next.logs.push(`sandbox.open:${sessionId}:${url}`);
    return next;
  }

  if (step.kind === "sandbox.click") {
    const sessionId = s(step.sessionId);
    const selector = s(step.selector);
    next.logs.push(`sandbox.click:${sessionId}:${selector}`);
    return next;
  }

  if (step.kind === "sandbox.type") {
    const sessionId = s(step.sessionId);
    const selector = s(step.selector);
    const text = s(step.text);
    next.logs.push(`sandbox.type:${sessionId}:${selector}:len=${text.length}`);
    return next;
  }

  if (step.kind === "sandbox.extract") {
    const sessionId = s(step.sessionId);
    const selector = s(step.selector);
    const outputKey = s(step.outputKey);
    next.values[outputKey] = `mock:${selector}`;
    next.logs.push(`sandbox.extract:${sessionId}:${selector}:out=${outputKey}`);
    return next;
  }

  return next;
}
