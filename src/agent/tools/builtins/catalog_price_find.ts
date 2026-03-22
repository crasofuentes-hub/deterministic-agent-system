import { findProductByName } from "../../../data-layer/product-repository";
import type { Tool } from "../types";

type PriceFindIn = Readonly<{
  productName: string;
}>;

type PriceFindOut = Readonly<{
  found: boolean;
  productName: string;
  price: number | null;
  currency: string | null;
}>;

export const toolCatalogPriceFind: Tool<PriceFindIn, PriceFindOut> = {
  id: "catalog/price-find",
  version: 1,
  meta: {
    pluginId: "builtin.catalog-price-find",
    pluginVersion: 1,
    displayName: "Catalog Price Find",
    description: "Finds the current product price by exact normalized product name.",
    capabilities: ["catalog.price-find"],
    inputSchemaHint: {
      type: "object",
      required: ["productName"]
    }
  },
  validateInput: (x: unknown): x is PriceFindIn => {
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
        price: null,
        currency: null,
      };
    }

    return {
      found: true,
      productName: product.name,
      price: product.price,
      currency: product.currency,
    };
  },
} as const;