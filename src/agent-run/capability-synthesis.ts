import type { ToolCapability } from "../agent/tools";

function uniqueStable(items: ToolCapability[]): ToolCapability[] {
  const seen = new Set<string>();
  const out: ToolCapability[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function synthesizeCapabilitiesFromGoal(goal: string): ToolCapability[] {
  const g = String(goal ?? "").normalize("NFC").trim().toLowerCase();
  const out: ToolCapability[] = [];

  if (g.includes("normalize") || g.includes("clean")) {
    out.push("text.normalize");
  }

  if (g.includes("extract") || g.includes("parse")) {
    out.push("json.extract");
  }

  if (g.includes("merge") || g.includes("combine")) {
    out.push("json.merge");
  }

  if ((g.includes("sum") || g.includes("add") || g.includes("math")) && out.length === 0) {
    out.push("math.add");
  }

  if (out.length === 0) {
    out.push("echo");
  }

  return uniqueStable(out);
}