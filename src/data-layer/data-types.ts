export type ProductAvailability = "in-stock" | "low-stock" | "out-of-stock";

export interface ProductRecord {
  productId: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  availability: ProductAvailability;
  stockQuantity: number;
}

export interface OrderRecord {
  orderId: string;
  status: string;
  customerName: string;
  items: string[];
  updatedAtIso: string;
}