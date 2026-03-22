import fs from "node:fs";
import path from "node:path";
import type { ProductRecord } from "./data-types";

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim().toLowerCase();
}

function loadProducts(): ProductRecord[] {
  const filePath = path.resolve(process.cwd(), "data/products.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ProductRecord[];
}

export function listProducts(): ProductRecord[] {
  return loadProducts();
}

export function findProductByName(productName: string): ProductRecord | undefined {
  const normalizedTarget = normalizeText(productName);

  return loadProducts().find(
    (product) => normalizeText(product.name) === normalizedTarget
  );
}

export function findProductBySku(sku: string): ProductRecord | undefined {
  const normalizedTarget = normalizeText(sku);

  return loadProducts().find(
    (product) => normalizeText(product.sku) === normalizedTarget
  );
}