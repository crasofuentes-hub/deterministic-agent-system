export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

export type ToolId = string;

export type ToolRunContext = Readonly<{
  // Reservado para tracing determinista si luego lo necesitas.
  // NO usar tiempo real para lógica.
  nowMs?: number;
}>;

export type Tool<I extends Json = Json, O extends Json = Json> = Readonly<{
  id: ToolId;
  version: 1;
  validateInput?: (input: unknown) => input is I;
  run: (ctx: ToolRunContext, input: I) => O;
}>;