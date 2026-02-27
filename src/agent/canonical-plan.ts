import type { DeterministicAgentPlan, AgentStep, AgentStepKind } from "./plan-types";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoExtraKeys(obj: UnknownRecord, allowed: string[], context: string): void {
  const extras = Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .sort();
  if (extras.length > 0) {
    throw new Error(context + " contains unsupported fields: " + extras.join(", "));
  }
}

function normalizeStringStrict(
  value: unknown,
  context: string,
  opts?: { maxLen?: number }
): string {
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

function normalizeHttpUrl(value: unknown, context: string): string {
  const url = normalizeStringStrict(value, context, { maxLen: 2048 });
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(context + " must start with http:// or https://");
  }
  return url;
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
  if (
    value === "set" ||
    value === "increment" ||
    value === "append_log" ||
    value === "sandbox.open" ||
    value === "sandbox.click" ||
    value === "sandbox.type" ||
    value === "sandbox.extract"
  ) {
    return value;
  }
  throw new Error(
    context +
      " must be one of: set, increment, append_log, sandbox.open, sandbox.click, sandbox.type, sandbox.extract"
  );
}

function normalizeStepValue(
  stepKind: AgentStepKind,
  value: unknown,
  context: string
): number | string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (stepKind === "increment") {
    return normalizeSafeInteger(value, context);
  }

  if (stepKind === "set" || stepKind === "append_log") {
    return normalizeStringStrict(value, context, { maxLen: 4096 });
  }

  // sandbox kinds must not use value
  throw new Error(context + " must not be present for " + stepKind);
}

function normalizeOptionalKey(
  stepKind: AgentStepKind,
  key: unknown,
  context: string
): string | undefined {
  if (stepKind === "append_log") {
    if (typeof key !== "undefined") {
      throw new Error(context + " must not contain key for append_log");
    }
    return undefined;
  }

  if (
    stepKind === "sandbox.open" ||
    stepKind === "sandbox.click" ||
    stepKind === "sandbox.type" ||
    stepKind === "sandbox.extract"
  ) {
    if (typeof key !== "undefined") {
      throw new Error(context + " must not contain key for " + stepKind);
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

  const kind = normalizeStepKind(value.kind, ctx + ".kind");
  const id = normalizeStringStrict(value.id, ctx + ".id", { maxLen: 256 });

  // sandbox steps
  if (
    kind === "sandbox.open" ||
    kind === "sandbox.click" ||
    kind === "sandbox.type" ||
    kind === "sandbox.extract"
  ) {
    assertNoExtraKeys(
      value,
      ["id", "kind", "sessionId", "url", "selector", "text", "outputKey"],
      ctx
    );

    const sessionId = normalizeStringStrict(value.sessionId, ctx + ".sessionId", { maxLen: 256 });

    const step: AgentStep = { id, kind, sessionId };

    if (kind === "sandbox.open") {
      step.url = normalizeHttpUrl(value.url, ctx + ".url");
      return step;
    }

    if (kind === "sandbox.click") {
      step.selector = normalizeStringStrict(value.selector, ctx + ".selector", { maxLen: 512 });
      return step;
    }

    if (kind === "sandbox.type") {
      step.selector = normalizeStringStrict(value.selector, ctx + ".selector", { maxLen: 512 });
      step.text = normalizeStringStrict(value.text, ctx + ".text", { maxLen: 4096 });
      return step;
    }

    // sandbox.extract
    step.selector = normalizeStringStrict(value.selector, ctx + ".selector", { maxLen: 512 });
    step.outputKey = normalizeStringStrict(value.outputKey, ctx + ".outputKey", { maxLen: 256 });
    return step;
  }

  // core v1 steps
  assertNoExtraKeys(value, ["id", "kind", "key", "value"], ctx);

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

  const aSession = typeof a.sessionId === "undefined" ? "" : a.sessionId;
  const bSession = typeof b.sessionId === "undefined" ? "" : b.sessionId;
  if (aSession < bSession) return -1;
  if (aSession > bSession) return 1;

  const aKey = typeof a.key === "undefined" ? "" : a.key;
  const bKey = typeof b.key === "undefined" ? "" : b.key;
  if (aKey < bKey) return -1;
  if (aKey > bKey) return 1;

  const aUrl = typeof a.url === "undefined" ? "" : a.url;
  const bUrl = typeof b.url === "undefined" ? "" : b.url;
  if (aUrl < bUrl) return -1;
  if (aUrl > bUrl) return 1;

  const aSel = typeof a.selector === "undefined" ? "" : a.selector;
  const bSel = typeof b.selector === "undefined" ? "" : b.selector;
  if (aSel < bSel) return -1;
  if (aSel > bSel) return 1;

  const aText = typeof a.text === "undefined" ? "" : a.text;
  const bText = typeof b.text === "undefined" ? "" : b.text;
  if (aText < bText) return -1;
  if (aText > bText) return 1;

  const aOut = typeof a.outputKey === "undefined" ? "" : a.outputKey;
  const bOut = typeof b.outputKey === "undefined" ? "" : b.outputKey;
  if (aOut < bOut) return -1;
  if (aOut > bOut) return 1;

  const aValueType =
    typeof a.value === "number" ? "number" : typeof a.value === "string" ? "string" : "undefined";
  const bValueType =
    typeof b.value === "number" ? "number" : typeof b.value === "string" ? "string" : "undefined";
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

  const normalizedSteps = plan.steps
    .map((s, i) => normalizeStepRaw(s, i));

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

