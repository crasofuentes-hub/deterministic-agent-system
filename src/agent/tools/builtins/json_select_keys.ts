import type { Tool, Json } from "../types";

type SelectKeysIn = Readonly<{
  text: string;
  keys: string[];
}>;

type SelectKeysOut = Readonly<{
  value: Json;
}>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
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

  if (isObjectRecord(value)) {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = toJson(value[k]);
    }
    return out;
  }

  return String(value);
}

export const toolJsonSelectKeys: Tool<SelectKeysIn, SelectKeysOut> = {
  id: "json/select-keys",
  version: 1,
  validateInput: (x: unknown): x is SelectKeysIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.text === "string" &&
      Array.isArray(o.keys) &&
      o.keys.every((k) => typeof k === "string" && k.trim().length > 0);
  },
  run: (_ctx, input) => {
    const text = String(input.text).normalize("NFC").trim();
    if (text.length === 0) {
      throw new Error("json_select_keys_empty_text");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("json_select_keys_invalid_json");
    }

    if (!isObjectRecord(parsed)) {
      throw new Error("json_select_keys_root_must_be_object");
    }

    const out: Record<string, Json> = {};
    const keys = Array.from(new Set(input.keys.map((k) => k.normalize("NFC").trim()))).sort();

    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) {
        out[k] = toJson(parsed[k]);
      }
    }

    return { value: out };
  },
} as const;