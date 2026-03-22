import fs from "node:fs";
import path from "node:path";
import type { OrderRecord } from "./data-types";

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim().toUpperCase();
}

function loadOrders(): OrderRecord[] {
  const filePath = path.resolve(process.cwd(), "data/orders.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as OrderRecord[];
}

export function listOrders(): OrderRecord[] {
  return loadOrders();
}

export function findOrderById(orderId: string): OrderRecord | undefined {
  const normalizedTarget = normalizeText(orderId);

  return loadOrders().find(
    (order) => normalizeText(order.orderId) === normalizedTarget
  );
}