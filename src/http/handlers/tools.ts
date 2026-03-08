import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";
import { ToolRegistry, toolEcho, toolJsonExtract, toolJsonSelectKeys, toolMathAdd, toolTextNormalize } from "../../agent/tools";

type ToolInfo = { readonly id: string; readonly version: number };

export async function handleTools(res: ServerResponse): Promise<void> {
  const reg = new ToolRegistry([toolEcho, toolJsonExtract, toolJsonSelectKeys, toolMathAdd, toolTextNormalize]);

  const tools: ToolInfo[] = reg.listIds().map((id: string) => {
    const t = reg.get(id as any);
    // listIds proviene del mismo Map: si get falla, es inconsistencia interna.
    const version = t ? t.version : 1;
    return { id, version };
  });

  sendJson(res, 200, { ok: true, result: { tools } });
}