import { findOrderById } from "../../../data-layer/order-repository";
import type { Tool } from "../types";

type OrderFindIn = Readonly<{
  orderId: string;
}>;

type OrderFindOut = Readonly<{
  found: boolean;
  order: null | {
    orderId: string;
    status: string;
    customerName: string;
    items: string[];
    updatedAtIso: string;
  };
}>;

export const toolOrdersFindById: Tool<OrderFindIn, OrderFindOut> = {
  id: "orders/find-by-id",
  version: 1,
  meta: {
    pluginId: "builtin.orders-find-by-id",
    pluginVersion: 1,
    displayName: "Orders Find By Id",
    description: "Finds an order by exact normalized order id.",
    capabilities: ["orders.find-by-id"],
    inputSchemaHint: {
      type: "object",
      required: ["orderId"]
    }
  },
  validateInput: (x: unknown): x is OrderFindIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.orderId === "string";
  },
  run: (_ctx, input) => {
    const orderId = String(input.orderId).normalize("NFC").trim();
    const order = findOrderById(orderId);

    if (!order) {
      return {
        found: false,
        order: null,
      };
    }

    return {
      found: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        customerName: order.customerName,
        items: [...order.items],
        updatedAtIso: order.updatedAtIso,
      },
    };
  },
} as const;