import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";
import { listAgentToolInfo } from "../../agent/tools";

type ToolInfo = { readonly id: string; readonly version: number };

export async function handleTools(res: ServerResponse): Promise<void> {
  

  const tools: ToolInfo[] = listAgentToolInfo();

  sendJson(res, 200, { ok: true, result: { tools } });
}