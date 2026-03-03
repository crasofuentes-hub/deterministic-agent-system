import type { Tool } from "../types";

type AddIn = { readonly a: number; readonly b: number };
type AddOut = { readonly sum: number };

export const toolMathAdd: Tool<AddIn, AddOut> = {
  id: "math/add",
  version: 1,
  validateInput: (x: unknown): x is AddIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as any;
    return typeof o.a === "number" && typeof o.b === "number";
  },
  run: (_ctx, input) => ({ sum: input.a + input.b }),
} as const;