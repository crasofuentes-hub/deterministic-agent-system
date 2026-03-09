import { ToolRegistry } from "./registry";
import { toolEcho } from "./builtins/echo";
import { toolMathAdd } from "./builtins/math_add";
import { toolTextNormalize } from "./builtins/text_normalize";
import { toolJsonExtract } from "./builtins/json_extract";
import { toolJsonSelectKeys } from "./builtins/json_select_keys";
import { toolJsonMerge } from "./builtins/json_merge";

export const AGENT_TOOL_DEFS = [
  toolEcho,
  toolJsonExtract,
  toolJsonMerge,
  toolJsonSelectKeys,
  toolMathAdd,
  toolTextNormalize,
] as const;

export function createAgentToolRegistry(): ToolRegistry {
  return new ToolRegistry([...AGENT_TOOL_DEFS]);
}

export function listAgentToolInfo(): Array<{
  id: string;
  version: 1;
  pluginId: string;
  pluginVersion: 1;
  displayName: string;
  description: string;
  capabilities: readonly string[];
  inputSchemaHint: { type: "object"; required: readonly string[] };
}> {
  const reg = createAgentToolRegistry();
  return reg.listIds().map((id) => {
    const tool = reg.get(id);
    if (!tool) {
      throw new Error("catalog registry desync for tool: " + id);
    }
    return {
      id: tool.id,
      version: tool.version,
      pluginId: tool.meta.pluginId,
      pluginVersion: tool.meta.pluginVersion,
      displayName: tool.meta.displayName,
      description: tool.meta.description,
      capabilities: [...tool.meta.capabilities],
      inputSchemaHint: {
        type: tool.meta.inputSchemaHint.type,
        required: [...tool.meta.inputSchemaHint.required],
      },
    };
  });
}