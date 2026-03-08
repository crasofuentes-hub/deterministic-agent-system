import type { AgentState, AgentStep } from "./plan-types";
import { ToolRegistry, toolEcho, toolMathAdd, toolTextNormalize } from "./tools";

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

function getCoreHashLike(state: AgentState): string {
  const sortedCounters: Record<string, number> = {};
  for (const k of Object.keys(state.counters).sort()) {
    const v = state.counters[k];
    if (typeof v === "number") sortedCounters[k] = v;
  }
  const sortedValues: Record<string, string> = {};
  for (const k of Object.keys(state.values).sort()) {
    const v = state.values[k];
    if (typeof v === "string") sortedValues[k] = v;
  }
  const canonical = JSON.stringify({ counters: sortedCounters, values: sortedValues });
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return "c" + hash.toString(16).padStart(8, "0");
}


function s(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}


function stableStringifyJson(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t === "number" || t === "boolean") return String(x);
  if (t === "string") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringifyJson).join(",") + "]";
  if (t === "object") {
    const o = x as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringifyJson(o[k])).join(",") + "}";
  }
  return JSON.stringify(String(x));
}

const TOOL_REGISTRY = new ToolRegistry([toolEcho, toolMathAdd, toolTextNormalize]);

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


  if (step.kind === "tool.call") {
    const toolId = s(step.toolId);
    const outputKey = s(step.outputKey);
    const input = step.input;

    const output = TOOL_REGISTRY.run(toolId, {}, input as any);
    next.values[outputKey] = stableStringifyJson(output);
    next.logs.push(`tool.call:${toolId}:out=${outputKey}`);
    return next;
  }


  if (step.kind === "tool.loop") {
    const toolId = s(step.toolId);
    const outputKey = s(step.outputKey);
    const input = step.input;
    const maxIterations = Number(step.maxIterations);

    let prevCoreHash = getCoreHashLike(next);
    for (let i = 0; i < maxIterations; i += 1) {
      const out = TOOL_REGISTRY.run(toolId, {}, input as any);
      next.values[outputKey] = stableStringifyJson(out);

      const afterCoreHash = getCoreHashLike(next);
      const fix = afterCoreHash === prevCoreHash;
      next.logs.push(`tool.loop:i=${i}:tool=${toolId}:out=${outputKey}:fix=${fix ? 1 : 0}`);
      if (fix) {
        return next;
      }
      prevCoreHash = afterCoreHash;
    }

    return next;
  }

  return next;
}
