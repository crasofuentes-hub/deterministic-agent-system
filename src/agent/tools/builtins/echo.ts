import type { Tool, Json } from "../types";

type EchoIn = { readonly value: Json };
type EchoOut = { readonly value: Json };

export const toolEcho: Tool<EchoIn, EchoOut> = {
  id: "echo",
  version: 1,
  meta: {
    pluginId: "builtin.echo",
    pluginVersion: 1,
    displayName: "Echo",
    description: "Returns the input value unchanged.",
    capabilities: ["echo"],
    inputSchemaHint: {
      type: "object",
      required: ["value"]
    }
  },
  validateInput: (x: unknown): x is EchoIn =>
    typeof x === "object" && x !== null && "value" in (x as any),
  run: (_ctx, input) => ({ value: input.value }),
} as const;