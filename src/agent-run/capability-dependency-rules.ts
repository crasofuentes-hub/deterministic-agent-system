import type { ToolCapability } from "../agent/tools";

export interface CapabilityInsertionResult {
  capabilities: ToolCapability[];
  inserted: ToolCapability[];
}

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

export function insertRequiredCapabilities(
  capabilities: ToolCapability[]
): CapabilityInsertionResult {
  const caps = uniqueStable(capabilities);
  const inserted: ToolCapability[] = [];
  const out: ToolCapability[] = [];

  const hasNormalize = caps.includes("text.normalize");
  const hasExtract = caps.includes("json.extract");
  const hasSelect = caps.includes("json.select");
  const hasMerge = caps.includes("json.merge");
  const hasMath = caps.includes("math.add");
  const hasEcho = caps.includes("echo");

  const hasCatalogProduct = caps.includes("catalog.product-find");
  const hasCatalogPrice = caps.includes("catalog.price-find");
  const hasCatalogAvailability = caps.includes("catalog.availability-find");
  const hasOrdersFindById = caps.includes("orders.find-by-id");
  const hasKbFindByProductName = caps.includes("kb.find-by-product-name");

  if (hasMath || hasEcho) {
    return {
      capabilities: caps,
      inserted,
    };
  }

  if (hasCatalogProduct) {
    out.push("catalog.product-find");
  }

  if (hasCatalogPrice) {
    out.push("catalog.price-find");
  }

  if (hasCatalogAvailability) {
    out.push("catalog.availability-find");
  }

  if (hasOrdersFindById) {
    out.push("orders.find-by-id");
  }

  if (hasKbFindByProductName) {
    out.push("kb.find-by-product-name");
  }

  if (hasNormalize) {
    out.push("text.normalize");
  }

  if ((hasSelect || hasMerge) && !hasExtract) {
    inserted.push("json.extract");
    out.push("json.extract");
  } else if (hasExtract) {
    out.push("json.extract");
  }

  if (hasSelect) {
    out.push("json.select");
  }

  if (hasMerge) {
    if (!hasSelect) {
      inserted.push("json.select");
      out.push("json.select");
    }
    out.push("json.merge");
  }

  return {
    capabilities: uniqueStable(out),
    inserted: uniqueStable(inserted),
  };
}