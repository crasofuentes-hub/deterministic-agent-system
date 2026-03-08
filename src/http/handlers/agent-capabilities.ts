import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";
import { ToolRegistry, toolEcho, toolJsonExtract, toolJsonSelectKeys, toolMathAdd, toolTextNormalize } from "../../agent/tools";

export async function handleAgentCapabilities(res: ServerResponse): Promise<void> {
  const reg = new ToolRegistry([toolEcho, toolJsonExtract, toolJsonSelectKeys, toolMathAdd, toolTextNormalize]);

  sendJson(res, 200, {
    ok: true,
    result: {
      endpoint: "/agent/run",
      planners: ["mock", "deterministic", "det-tools", "det-replan", "det-replan2", "llm-mock"],
      demos: ["core", "sandbox"],
      modes: ["mock", "local"],
      bounds: {
        maxSteps: { min: 1 },
        toolLoop: { maxIterations: { min: 1 } }
      },
      tools: reg.listIds(), // ya viene orden determinista
      features: {
        toolCall: true,
        toolLoopFixpoint: true,
        deterministicToolErrors: true,
        traceChain: true
      }
    }
  });
}