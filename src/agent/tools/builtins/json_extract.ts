import type { Tool, Json } from "../types";

type ExtractIn = Readonly<{
  text: string;
  path: string;
}>;

type ExtractOut = Readonly<{
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

function extractPath(root: unknown, path: string): unknown {
  const parts = path.split(".").filter((x) => x.length > 0);
  let current: unknown = root;

  for (const part of parts) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(part)) {
        throw new Error("json_extract_invalid_path");
      }
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error("json_extract_path_not_found");
      }
      current = current[index];
      continue;
    }

    if (typeof current === "object" && current !== null) {
      const obj = current as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, part)) {
        throw new Error("json_extract_path_not_found");
      }
      current = obj[part];
      continue;
    }

    throw new Error("json_extract_path_not_found");
  }

  return current;
}

export const toolJsonExtract: Tool<ExtractIn, ExtractOut> = {
  id: "json/extract",
  version: 1,
  meta: {
    pluginId: "builtin.json-extract",
    pluginVersion: 1,
    displayName: "JSON Extract",
    description: "Extracts a value from JSON text using a deterministic dotted path.",
    capabilities: ["json.extract"],
    inputSchemaHint: {
      type: "object",
      required: ["text", "path"]
    }
  },
  validateInput: (x: unknown): x is ExtractIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.text === "string" && typeof o.path === "string";
  },
  run: (_ctx, input) => {
    const text = String(input.text).normalize("NFC").trim();
    const path = String(input.path).normalize("NFC").trim();

    if (text.length === 0) {
      throw new Error("json_extract_empty_text");
    }

    if (path.length === 0) {
      throw new Error("json_extract_empty_path");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("json_extract_invalid_json");
    }

    const value = extractPath(parsed, path);
    return { value: toJson(value) };
  },
} as const;