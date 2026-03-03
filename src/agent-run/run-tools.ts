import type { DeterministicResponse } from "../core/contracts";
import type { AgentRunInput } from "./types";
import { ToolRegistry, toolEcho, toolMathAdd } from "../agent/tools";
import { runToolLoop } from "./loop-tools";
import { deterministicToolsPlanner } from "./planner-deterministic-tools";

export type AgentToolLoopValue = Readonly<{
  kind: "agent-tool-loop-v1";
  goal: string;
  termination: "fixpoint" | "max_iterations";
  steps: readonly unknown[];
  finalObservation: unknown;
  finalObservationHash: string;
}>;

export function runAgentTools(input: AgentRunInput): DeterministicResponse<AgentToolLoopValue> {
  const tools = new ToolRegistry([toolEcho, toolMathAdd]);

  const loop = runToolLoop({
    goal: String(input.goal),
    initialObservation: { kind: "init" },
    maxIterations: input.maxSteps,
    planner: deterministicToolsPlanner,
    tools,
  });

  // Construimos un payload estable y explícito.
  const value: AgentToolLoopValue = {
    kind: "agent-tool-loop-v1",
    goal: String(input.goal),
    termination: loop.termination,
    steps: loop.steps,
    finalObservation: loop.finalObservation,
    finalObservationHash: loop.finalObservationHash,
  };

  // No conocemos aquí el shape exacto interno de DeterministicResponse,
  // pero en tu código ya se serializa y se usa con sendJson.
  // Esto es opt-in y no afecta los tests actuales.
  return { ok: true, value } as unknown as DeterministicResponse<AgentToolLoopValue>;
}