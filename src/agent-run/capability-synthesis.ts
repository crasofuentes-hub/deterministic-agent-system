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

  if (g.includes("select") || g.includes("pick keys")) {
    out.push("json.select");
  }

  if (g.includes("merge") || g.includes("combine")) {
    out.push("json.merge");
  }

  const mentionsProduct =
    g.includes("product") ||
    g.includes("catalog") ||
    g.includes("item") ||
    g.includes("sku");

  const mentionsPrice =
    g.includes("price") ||
    g.includes("cost") ||
    g.includes("cuesta") ||
    g.includes("precio");

  const mentionsAvailability =
    g.includes("availability") ||
    g.includes("available") ||
    g.includes("stock") ||
    g.includes("disponibilidad") ||
    g.includes("disponible") ||
    g.includes("existencia");

  const mentionsOrder =
    g.includes("order") ||
    g.includes("pedido") ||
    g.includes("orden");

  const mentionsKnowledge =
    g.includes("summary") ||
    g.includes("about") ||
    g.includes("details") ||
    g.includes("informacion") ||
    g.includes("información");

  if (mentionsOrder) {
    out.push("orders.find-by-id");
  }

  if (mentionsAvailability) {
    out.push("catalog.availability-find");
  }

  if (mentionsPrice) {
    out.push("catalog.price-find");
  }

  if (mentionsProduct && !mentionsPrice && !mentionsAvailability) {
    out.push("catalog.product-find");
  }

  if (mentionsKnowledge || (mentionsProduct && !mentionsPrice && !mentionsAvailability)) {
    out.push("kb.find-by-product-name");
  }

  if ((g.includes("sum") || g.includes("add") || g.includes("math")) && out.length === 0) {
    out.push("math.add");
  }

  if (out.length === 0) {
    out.push("echo");
  }

  return uniqueStable(out);
}