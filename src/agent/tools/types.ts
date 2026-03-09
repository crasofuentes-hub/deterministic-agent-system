export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

export type ToolId = string;

export type ToolRunContext = Readonly<{
  nowMs?: number;
}>;

export type ToolCapability =
  | "text.normalize"
  | "json.extract"
  | "json.select"
  | "json.merge"
  | "math.add"
  | "echo";

export type ToolInputSchemaHint = Readonly<{
  type: "object";
  required: readonly string[];
}>;

export type ToolPluginMeta = Readonly<{
  pluginId: string;
  pluginVersion: 1;
  displayName: string;
  description: string;
  capabilities: readonly ToolCapability[];
  inputSchemaHint: ToolInputSchemaHint;
}>;

export type Tool<I extends Json = Json, O extends Json = Json> = Readonly<{
  id: ToolId;
  version: 1;
  meta: ToolPluginMeta;
  validateInput?: (input: unknown) => input is I;
  run: (ctx: ToolRunContext, input: I) => O;
}>;