export interface ProductRecord {
  productId: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  availability: string;
  stockQuantity: number;
  eligibilityStatus?: string;
  underwritingReviewRequired?: boolean;
  brokerReviewRequired?: boolean;
  additionalDocumentsRequired?: boolean;
  availabilityNotes?: string;
}

export interface OrderRecord {
  orderId: string;
  status: string;
  customerName: string;
  items: string[];
  updatedAtIso: string;
}