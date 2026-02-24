import type { ToolAdapter } from "./types";

export class ToolRegistry {
  private readonly byName: Record<string, ToolAdapter>;

  constructor(tools: ToolAdapter[]) {
    const map: Record<string, ToolAdapter> = {};
    for (const t of tools) {
      if (!t || typeof t.toolName !== "string" || t.toolName.trim().length === 0) {
        throw new Error("Invalid tool registration");
      }
      if (map[t.toolName]) {
        throw new Error("Duplicate tool registration: " + t.toolName);
      }
      map[t.toolName] = t;
    }
    this.byName = map;
  }

  get(toolName: string): ToolAdapter | undefined {
    return this.byName[toolName];
  }

  list(): string[] {
    return Object.keys(this.byName).sort();
  }
}
