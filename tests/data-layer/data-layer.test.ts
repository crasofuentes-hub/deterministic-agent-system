import { describe, expect, it } from "vitest";
import { findOrderById, listOrders } from "../../src/data-layer/order-repository";
import { findProductByName, findProductBySku, listProducts } from "../../src/data-layer/product-repository";

describe("data-layer", () => {
  it("loads products deterministically", () => {
    expect(listProducts()).toHaveLength(3);
  });

  it("finds product by exact name deterministically", () => {
    expect(findProductByName("Laptop X Pro")).toEqual({
      productId: "prod-laptop-x-pro",
      sku: "LAP-X-PRO",
      name: "Laptop X Pro",
      price: 1499.99,
      currency: "USD",
      availability: "in-stock",
      stockQuantity: 12,
    });
  });

  it("finds product by sku deterministically", () => {
    expect(findProductBySku("mou-w-m1")?.name).toBe("Wireless Mouse M1");
  });

  it("loads orders deterministically", () => {
    expect(listOrders()).toHaveLength(3);
  });

  it("finds order by id deterministically", () => {
    expect(findOrderById("order-12345")).toEqual({
      orderId: "ORDER-12345",
      status: "processing",
      customerName: "Oscar",
      items: ["Laptop X Pro"],
      updatedAtIso: "2026-03-10T10:00:00Z",
    });
  });
});