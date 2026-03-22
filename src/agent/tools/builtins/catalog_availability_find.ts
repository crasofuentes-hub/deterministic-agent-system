import { findProductByName } from "../../../data-layer/product-repository";
import type { Tool } from "../types";

type AvailabilityFindIn = Readonly<{
  productName: string;
}>;

type AvailabilityFindOut = Readonly<{
  found: boolean;
  productName: string;
  availability: string | null;
  stockQuantity: number | null;
}>;

export const toolCatalogAvailabilityFind: Tool<AvailabilityFindIn, AvailabilityFindOut> = {
  id: "catalog/availability-find",
  version: 1,
  meta: {
    pluginId: "builtin.catalog-availability-find",
    pluginVersion: 1,
    displayName: "Catalog Availability Find",
    description: "Finds product availability and stock by exact normalized product name.",
    capabilities: ["catalog.availability-find"],
    inputSchemaHint: {
      type: "object",
      required: ["productName"]
    }
  },
  validateInput: (x: unknown): x is AvailabilityFindIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.productName === "string";
  },
  run: (_ctx, input) => {
    const productName = String(input.productName).normalize("NFC").trim();
    const product = findProductByName(productName);

    if (!product) {
      return {
        found: false,
        productName,
        availability: null,
        stockQuantity: null,
      };
    }

    return {
      found: true,
      productName: product.name,
      availability: product.availability,
      stockQuantity: product.stockQuantity,
    };
  },
} as const;