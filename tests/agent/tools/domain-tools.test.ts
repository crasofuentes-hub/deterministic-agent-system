import { describe, expect, it } from "vitest";
import { createAgentToolRegistry } from "../../../src/agent/tools/catalog";

describe("domain tools", () => {
  it("registers sales/customer-service tools", () => {
    const registry = createAgentToolRegistry();

    expect(registry.get("catalog/product-find")).toBeDefined();
    expect(registry.get("catalog/price-find")).toBeDefined();
    expect(registry.get("catalog/availability-find")).toBeDefined();
    expect(registry.get("orders/find-by-id")).toBeDefined();
    expect(registry.get("kb/find-by-product-name")).toBeDefined();
  });

  it("finds product by name deterministically", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.get("catalog/product-find");
    if (!tool) throw new Error("missing tool");

    expect(tool.run({}, { productName: "Laptop X Pro" })).toEqual({
      found: true,
      product: {
        productId: "prod-laptop-x-pro",
        sku: "LAP-X-PRO",
        name: "Laptop X Pro",
        price: 1499.99,
        currency: "USD",
        availability: "in-stock",
        stockQuantity: 12,
      },
    });
  });

  it("finds price deterministically", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.get("catalog/price-find");
    if (!tool) throw new Error("missing tool");

    expect(tool.run({}, { productName: "Laptop X Pro" })).toEqual({
      found: true,
      productName: "Laptop X Pro",
      price: 1499.99,
      currency: "USD",
    });
  });

  it("finds availability deterministically", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.get("catalog/availability-find");
    if (!tool) throw new Error("missing tool");

    expect(tool.run({}, { productName: "Laptop X Pro" })).toEqual({
      found: true,
      productName: "Laptop X Pro",
      availability: "in-stock",
      stockQuantity: 12,
    });
  });

  it("finds order by id deterministically", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.get("orders/find-by-id");
    if (!tool) throw new Error("missing tool");

    expect(tool.run({}, { orderId: "ORDER-12345" })).toEqual({
      found: true,
      order: {
        orderId: "ORDER-12345",
        status: "processing",
        customerName: "Oscar",
        items: ["Laptop X Pro"],
        updatedAtIso: "2026-03-10T10:00:00Z",
      },
    });
  });

  it("finds product knowledge deterministically", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.get("kb/find-by-product-name");
    if (!tool) throw new Error("missing tool");

    expect(tool.run({}, { productName: "Laptop X Pro" })).toEqual({
      found: true,
      record: {
        topicId: "product-laptop-x-pro",
        productName: "Laptop X Pro",
        summary: "Laptop X Pro is a high-performance laptop for productivity and advanced workloads.",
      },
    });
  });
});