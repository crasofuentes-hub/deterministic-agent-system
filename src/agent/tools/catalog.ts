import { ToolRegistry } from "./registry";
import {
  toolEcho,
  toolJsonExtract,
  toolJsonSelectKeys,
  toolMathAdd,
  toolTextNormalize,
} from "./index";

export const AGENT_TOOL_DEFS = [
  toolEcho,
  toolJsonExtract,
  toolJsonSelectKeys,
  toolMathAdd,
  toolTextNormalize,
] as const;

export function createAgentToolRegistry(): ToolRegistry {
  return new ToolRegistry([...AGENT_TOOL_DEFS]);
}

export function listAgentToolInfo(): Array<{ id: string; version: 1 }> {
  const reg = createAgentToolRegistry();
  return reg.listIds().map((id) => {
    const tool = reg.get(id);
    if (!tool) {
      throw new Error("catalog registry desync for tool: " + id);
    }
    return {
      id: tool.id,
      version: tool.version,
    };
  });
}