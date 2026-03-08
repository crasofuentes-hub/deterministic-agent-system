import type { Tool } from "../types";

type NormalizeIn = Readonly<{
  text: string;
  trim?: boolean;
  lowercase?: boolean;
  collapseWhitespace?: boolean;
}>;

type NormalizeOut = Readonly<{
  text: string;
}>;

export const toolTextNormalize: Tool<NormalizeIn, NormalizeOut> = {
  id: "text/normalize",
  version: 1,
  validateInput: (x: unknown): x is NormalizeIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    if (typeof o.text !== "string") return false;
    if (typeof o.trim !== "undefined" && typeof o.trim !== "boolean") return false;
    if (typeof o.lowercase !== "undefined" && typeof o.lowercase !== "boolean") return false;
    if (typeof o.collapseWhitespace !== "undefined" && typeof o.collapseWhitespace !== "boolean") return false;
    return true;
  },
  run: (_ctx, input) => {
    let out = String(input.text).normalize("NFC");

    if (input.collapseWhitespace === true) {
      out = out.replace(/\s+/g, " ");
    }

    if (input.trim !== false) {
      out = out.trim();
    }

    if (input.lowercase === true) {
      out = out.toLowerCase();
    }

    return { text: out };
  },
} as const;