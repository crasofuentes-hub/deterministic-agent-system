import type { AgentStep } from "../agent/plan-types";

export interface StepDependencyRef {
  refKind: "$ref" | "__valueFromState";
  refExpr: string;
  outputKey: string;
  nestedPath: string;
}

export type StepDependencyValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function isSingleRefObject(
  value: unknown
): value is { $ref?: unknown; __valueFromState?: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) {
    return false;
  }

  return keys[0] === "$ref" || keys[0] === "__valueFromState";
}

function parseStepDependencyRef(value: unknown): StepDependencyRef | null {
  if (!isSingleRefObject(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const refKind = Object.keys(obj)[0] as "$ref" | "__valueFromState";
  const rawValue = obj[refKind];

  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = trimmed.startsWith("state.values.")
    ? trimmed.slice("state.values.".length)
    : trimmed;

  const firstDot = normalized.indexOf(".");
  const outputKey = firstDot >= 0 ? normalized.slice(0, firstDot) : normalized;
  const nestedPath = firstDot >= 0 ? normalized.slice(firstDot + 1) : "";

  if (outputKey.trim().length === 0) {
    return null;
  }

  return {
    refKind,
    refExpr: trimmed,
    outputKey,
    nestedPath,
  };
}

export function collectStepDependencyRefs(value: unknown): StepDependencyRef[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStepDependencyRefs(item));
  }

  const directRef = parseStepDependencyRef(value);
  if (directRef) {
    return [directRef];
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const out: StepDependencyRef[] = [];
    for (const key of Object.keys(obj)) {
      out.push(...collectStepDependencyRefs(obj[key]));
    }
    return out;
  }

  return [];
}

function isProducerStep(step: AgentStep): boolean {
  return (
    step.kind === "tool.call" &&
    typeof step.outputKey === "string" &&
    step.outputKey.trim().length > 0
  );
}

export function validateStepDependencies(
  steps: AgentStep[]
): StepDependencyValidationResult {
  const producedAtStepIndex = new Map<string, number>();

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];

    if (!isProducerStep(step)) {
      continue;
    }

    const outputKey = String(step.outputKey).trim();

    if (producedAtStepIndex.has(outputKey)) {
      const firstIndex = producedAtStepIndex.get(outputKey)!;
      return {
        ok: false,
        code: "DUPLICATE_STEP_OUTPUT_KEY",
        message:
          'outputKey "' +
          outputKey +
          '" is produced more than once (step indices ' +
          firstIndex +
          " and " +
          i +
          ")",
      };
    }

    producedAtStepIndex.set(outputKey, i);
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const refs = collectStepDependencyRefs(step.input);

    for (const ref of refs) {
      const producerIndex = producedAtStepIndex.get(ref.outputKey);

      if (producerIndex === undefined) {
        return {
          ok: false,
          code: "STEP_DEPENDENCY_PRODUCER_NOT_FOUND",
          message:
            'step "' +
            step.id +
            '" references missing outputKey "' +
            ref.outputKey +
            '" via ' +
            ref.refKind +
            " = " +
            JSON.stringify(ref.refExpr),
        };
      }

      if (producerIndex >= i) {
        return {
          ok: false,
          code: "STEP_DEPENDENCY_OUT_OF_ORDER",
          message:
            'step "' +
            step.id +
            '" references outputKey "' +
            ref.outputKey +
            '" before it is produced',
        };
      }
    }
  }

  return { ok: true };
}