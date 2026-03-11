import type { ToolCapability } from "../agent/tools";
import { insertRequiredCapabilities } from "./capability-dependency-rules";

function uniqueStable(items: ToolCapability[]): ToolCapability[] {
  const seen = new Set<string>();
  const out: ToolCapability[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function normalizeCapabilityPipeline(capabilities: ToolCapability[]): ToolCapability[] {
  const caps = uniqueStable(capabilities);

  const hasMath = caps.includes("math.add");
  const hasEcho = caps.includes("echo");

  if (hasMath) {
    return ["math.add"];
  }

  if (hasEcho && caps.length === 1) {
    return ["echo"];
  }

  const insertion = insertRequiredCapabilities(caps);
  return insertion.capabilities;
}

export function validateCapabilityPipeline(capabilities: ToolCapability[]): { ok: true } | { ok: false; code: string; message: string } {
  const caps = uniqueStable(capabilities);

  if (caps.length === 0) {
    return {
      ok: false,
      code: "EMPTY_CAPABILITY_PIPELINE",
      message: "Capability pipeline must not be empty"
    };
  }

  const hasMath = caps.includes("math.add");
  const hasEcho = caps.includes("echo");
  const hasExtract = caps.includes("json.extract");
  const hasSelect = caps.includes("json.select");
  const hasMerge = caps.includes("json.merge");

  if (hasMath && caps.length > 1) {
    return {
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "math.add cannot be combined with other capabilities"
    };
  }

  if (hasEcho && caps.length > 1) {
    return {
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "echo cannot be combined with other capabilities"
    };
  }

  if ((hasSelect || hasMerge) && !hasExtract) {
    return {
      ok: false,
      code: "MISSING_EXTRACT_PRECONDITION",
      message: "json.select/json.merge require json.extract in normalized pipeline"
    };
  }

  if (hasMerge && !hasSelect) {
    return {
      ok: false,
      code: "MISSING_SELECT_PRECONDITION",
      message: "json.merge requires json.select in normalized pipeline"
    };
  }

  return { ok: true };
}