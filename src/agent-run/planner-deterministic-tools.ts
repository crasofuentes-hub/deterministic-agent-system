import type { Json } from "../agent/tools/types";
import type { ToolAction } from "./loop-tools";

export function deterministicToolsPlanner(args: Readonly<{
  goal: string;
  observation: Json;
  i: number;
}>): ToolAction {
  void args.goal;

  if (args.i === 0) {
    return { kind: "tool", toolId: "math/add", input: { a: 1, b: 2 } };
  }

  const prev = args.observation as any;
  const prevOutput = prev && typeof prev === "object" ? (prev as any).output : null;

  return {
    kind: "tool",
    toolId: "echo",
    input: { value: prevOutput },
  };
}