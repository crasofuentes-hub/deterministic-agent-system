import type { Tool, Json } from "../types";

type EchoIn = { readonly value: Json };
type EchoOut = { readonly value: Json };

export const toolEcho: Tool<EchoIn, EchoOut> = {
  id: "echo",
  version: 1,
  validateInput: (x: unknown): x is EchoIn =>
    typeof x === "object" && x !== null && "value" in (x as any),
  run: (_ctx, input) => ({ value: input.value }),
} as const;