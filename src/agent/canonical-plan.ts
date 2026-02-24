import type { DeterministicAgentPlan, AgentStep, AgentStepKind } from "./plan-types";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoExtraKeys(obj: UnknownRecord, allowed: string[], context: string): void {
  const extras = Object.keys(obj).filter((k) => !allowed.includes(k)).sort();
  if (extras.length > 0) {
    throw new Error(context + " contains unsupported fields: " + extras.join(", "));
  }
}

function normalizeStringStrict(value: unknown, context: string, opts?: { maxLen?: number }): string {
  if (typeof value !== "string") {
    throw new Error(context + " must be a string");
  }
  const normalized = value.normalize("NFC").trim();
  if (normalized.length === 0) {
    throw new Error(context + " must be a non-empty string");
  }
  if (typeof opts?.maxLen === "number" && normalized.length > opts.maxLen) {
    throw new Error(context + " exceeds max length " + String(opts.maxLen));
  }
  return normalized;
}

function normalizeSafeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(context + " must be a finite integer");
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(context + " must be a safe integer");
  }
  return value;
}

function normalizeStepKind(value: unknown, context: string): AgentStepKind {
  if (value === "set" || value === "increment" || value === "append_log") {
    return value;
  }
  throw new Error(context + " must be one of: set, increment, append_log");
}

function normalizeStepValue(stepKind: AgentStepKind, value: unknown, context: string): number | string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (stepKind === "increment") {
    return normalizeSafeInteger(value, context);
  }

  if (stepKind === "set" || stepKind === "append_log") {
    return normalizeStringStrict(value, context, { maxLen: 4096 });
  }

  throw new Error(context + " unsupported step kind");
}

function normalizeOptionalKey(stepKind: AgentStepKind, key: unknown, context: string): string | undefined {
  if (stepKind === "append_log") {
    if (typeof key !== "undefined") {
      throw new Error(context + " must not contain key for append_log");
    }
    return undefined;
  }

  return normalizeStringStrict(key, context, { maxLen: 256 });
}

function normalizeStepRaw(value: unknown, index: number): AgentStep {
  const ctx = "steps[" + String(index) + "]";
  if (!isObject(value)) {
    throw new Error(ctx + " must be an object");
  }

  assertNoExtraKeys(value, ["id", "kind", "key", "value"], ctx);

  const kind = normalizeStepKind(value.kind, ctx + ".kind");
  const id = normalizeStringStrict(value.id, ctx + ".id", { maxLen: 256 });
  const key = normalizeOptionalKey(kind, value.key, ctx + ".key");
  const normalizedValue = normalizeStepValue(kind, value.value, ctx + ".value");

  if (kind === "increment" && typeof normalizedValue !== "number") {
    throw new Error(ctx + ".value must be integer for increment");
  }

  if ((kind === "set" || kind === "append_log") && typeof normalizedValue !== "string") {
    throw new Error(ctx + ".value must be string for " + kind);
  }

  const step: AgentStep = { id, kind };
  if (typeof key !== "undefined") step.key = key;
  if (typeof normalizedValue !== "undefined") step.value = normalizedValue;
  return step;
}

function compareSteps(a: AgentStep, b: AgentStep): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;

  if (a.kind < b.kind) return -1;
  if (a.kind > b.kind) return 1;

  const aKey = typeof a.key === "undefined" ? "" : a.key;
  const bKey = typeof b.key === "undefined" ? "" : b.key;
  if (aKey < bKey) return -1;
  if (aKey > bKey) return 1;

  const aValueType = typeof a.value === "number" ? "number" : typeof a.value === "string" ? "string" : "undefined";
  const bValueType = typeof b.value === "number" ? "number" : typeof b.value === "string" ? "string" : "undefined";
  if (aValueType < bValueType) return -1;
  if (aValueType > bValueType) return 1;

  const aVal = typeof a.value === "undefined" ? "" : String(a.value);
  const bVal = typeof b.value === "undefined" ? "" : String(b.value);
  if (aVal < bVal) return -1;
  if (aVal > bVal) return 1;

  return 0;
}

export function canonicalizePlan(plan: DeterministicAgentPlan): DeterministicAgentPlan {
  if (!isObject(plan)) {
    throw new Error("plan must be an object");
  }

  assertNoExtraKeys(plan, ["planId", "version", "steps"], "plan");

  const planId = normalizeStringStrict(plan.planId, "plan.planId", { maxLen: 256 });

  if (plan.version !== 1) {
    throw new Error("plan.version must be 1");
  }

  if (!Array.isArray(plan.steps)) {
    throw new Error("plan.steps must be an array");
  }

  const normalizedSteps = plan.steps.map((s, i) => normalizeStepRaw(s, i)).slice().sort(compareSteps);

  const seen = new Set<string>();
  for (const s of normalizedSteps) {
    if (seen.has(s.id)) {
      throw new Error("Duplicate step id in canonical plan: " + s.id);
    }
    seen.add(s.id);
  }

  return {
    planId,
    version: 1,
    steps: normalizedSteps,
  };
}

export function toCanonicalPlanJson(plan: DeterministicAgentPlan): string {
  const canon = canonicalizePlan(plan);
  return JSON.stringify(canon);
}