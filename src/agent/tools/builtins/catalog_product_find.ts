import { findProductByName } from "../../../data-layer/product-repository";
import type { Tool } from "../types";

type ProductFindIn = Readonly<{
  productName: string;
}>;

type ProductFindOut = Readonly<{
  found: boolean;
  product: null | {
    productId: string;
    sku: string;
    name: string;
    price: number;
    currency: string;
    availability: string;
    stockQuantity: number;
  };
}>;

export const toolCatalogProductFind: Tool<ProductFindIn, ProductFindOut> = {
  id: "catalog/product-find",
  version: 1,
  meta: {
    pluginId: "builtin.catalog-product-find",
    pluginVersion: 1,
    displayName: "Catalog Product Find",
    description: "Finds a product by exact normalized product name.",
    capabilities: ["catalog.product-find"],
    inputSchemaHint: {
      type: "object",
      required: ["productName"]
    }
  },
  validateInput: (x: unknown): x is ProductFindIn => {
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
        product: null,
      };
    }

    return {
      found: true,
      product: {
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        currency: product.currency,
        availability: product.availability,
        stockQuantity: product.stockQuantity,
      },
    };
  },
} as const;