import type { Tool, ToolId, ToolRunContext, Json } from "./types";

// Type-erasure intencional: el registry almacena tools heterogéneos.
// La seguridad de entrada se aplica vía validateInput (si existe).
type AnyTool = Tool<any, any>;

export class ToolRegistry {
  private readonly tools: Map<ToolId, AnyTool>;

  constructor(tools: readonly AnyTool[]) {
    const m = new Map<ToolId, AnyTool>();
    for (const t of tools) {
      if (m.has(t.id)) throw new Error(`ToolRegistry: duplicate tool id: ${t.id}`);
      if (t.version !== 1) throw new Error(`ToolRegistry: unsupported tool version for ${t.id}`);
      m.set(t.id, t);
    }
    this.tools = m;
  }

  listIds(): string[] {
    return Array.from(this.tools.keys()).sort(); // orden determinista
  }

  has(id: ToolId): boolean {
    return this.tools.has(id);
  }

  get(id: ToolId): AnyTool | undefined {
    return this.tools.get(id);
  }

  run(id: ToolId, ctx: ToolRunContext, input: Json): Json {
    const t = this.tools.get(id);
    if (!t) throw new Error(`tool_not_found: ${id}`);

    if (t.validateInput && !t.validateInput(input)) {
      throw new Error(`tool_invalid_input: ${id}`);
    }

    // Ejecuta tras validación. Cast controlado para soportar tools con inputs específicos.
    return (t.run as any)(ctx, input) as Json;
  }
}