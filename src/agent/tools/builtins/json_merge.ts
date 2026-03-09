import type { Tool, Json } from "../types";

type JsonObject = { [k: string]: Json };
type MergeSide = string | JsonObject;

type MergeIn = Readonly<{
  left: MergeSide;
  right: MergeSide;
}>;

type MergeOut = Readonly<{
  value: Json;
}>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((x) => toJson(x));
  }

  if (isJsonObject(value)) {
    const out: JsonObject = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = toJson(value[k]);
    }
    return out;
  }

  return String(value);
}

function parseMergeSide(value: MergeSide, label: string): JsonObject {
  if (isJsonObject(value)) {
    return value;
  }

  const normalized = String(value).normalize("NFC").trim();
  if (normalized.length === 0) {
    throw new Error("json_merge_empty_" + label);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("json_merge_invalid_" + label);
  }

  if (!isJsonObject(parsed)) {
    throw new Error("json_merge_" + label + "_must_be_object");
  }

  return parsed;
}

export const toolJsonMerge: Tool<MergeIn, MergeOut> = {
  id: "json/merge",
  version: 1,
  validateInput: (x: unknown): x is MergeIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;

    const leftOk = typeof o.left === "string" || isJsonObject(o.left);
    const rightOk = typeof o.right === "string" || isJsonObject(o.right);

    return leftOk && rightOk;
  },
  run: (_ctx, input) => {
    const left = parseMergeSide(input.left, "left");
    const right = parseMergeSide(input.right, "right");

    const merged: JsonObject = {};

    for (const k of Object.keys(left).sort()) {
      merged[k] = toJson(left[k]);
    }

    for (const k of Object.keys(right).sort()) {
      merged[k] = toJson(right[k]);
    }

    return { value: merged };
  },
} as const;