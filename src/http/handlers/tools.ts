import { success } from "../../core/contracts";
import { listAgentToolInfo } from "../../agent/tools";

type ToolInfo = {
  id: string;
  version: 1;
  pluginId: string;
  pluginVersion: 1;
  displayName: string;
  description: string;
  capabilities: readonly string[];
  inputSchemaHint: { type: "object"; required: readonly string[] };
};

export function handleTools(): { statusCode: number; body: unknown } {
  const tools: ToolInfo[] = listAgentToolInfo();

  return {
    statusCode: 200,
    body: success({ tools }, { mode: "mock" }),
  };
}