import { createHash } from "node:crypto";
import type { Json } from "../agent/tools/types";
import { ToolRegistry } from "../agent/tools/registry";

export type ToolAction = Readonly<{
  kind: "tool";
  toolId: string;
  input: Json;
}>;

export type ToolStep = Readonly<{
  i: number;
  action: ToolAction;
  output: Json;
  observation: Json;
  observationHash: string;
}>;

export type ToolLoopResult = Readonly<{
  termination: "fixpoint" | "max_iterations";
  steps: readonly ToolStep[];
  finalObservation: Json;
  finalObservationHash: string;
}>;

function stableStringify(x: Json): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t === "number" || t === "boolean") return String(x);
  if (t === "string") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const o = x as Record<string, Json>;
  const keys = Object.keys(o).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(o[k] ?? null)).join(",") + "}";
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function hashJson(x: Json): string {
  return sha256Hex(stableStringify(x));
}

export type ToolPlanner = (args: Readonly<{
  goal: string;
  observation: Json;
  i: number;
}>) => ToolAction;

export function runToolLoop(args: Readonly<{
  goal: string;
  initialObservation: Json;
  maxIterations: number;
  planner: ToolPlanner;
  tools: ToolRegistry;
}>): ToolLoopResult {
  const steps: ToolStep[] = [];

  let obs: Json = args.initialObservation;
  let obsHash = hashJson(obs);

  for (let i = 0; i < args.maxIterations; i++) {
    const action = args.planner({ goal: args.goal, observation: obs, i });

    const output = args.tools.run(action.toolId, {}, action.input);

    const nextObs: Json = {
      kind: "tool_result",
      toolId: action.toolId,
      input: action.input,
      output,
    };

    const nextHash = hashJson(nextObs);

    steps.push({
      i,
      action,
      output,
      observation: nextObs,
      observationHash: nextHash,
    });

    if (nextHash === obsHash) {
      return {
        termination: "fixpoint",
        steps,
        finalObservation: nextObs,
        finalObservationHash: nextHash,
      };
    }

    obs = nextObs;
    obsHash = nextHash;
  }

  return {
    termination: "max_iterations",
    steps,
    finalObservation: obs,
    finalObservationHash: obsHash,
  };
}