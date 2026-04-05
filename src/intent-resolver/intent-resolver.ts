export interface ResolvedIntentResult {
  intentId: string;
  confidence: "rule";
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim().toLowerCase();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function isHumanHandoffIntent(text: string): boolean {
  return includesAny(text, [
    "human agent",
    "live agent",
    "customer representative",
    "representative",
    "support agent",
    "speak with someone",
    "talk to someone",
    "talk to an agent",
    "speak with an agent",
    "human support",
    "licensed broker",
    "broker specialist",
    "speak with a broker",
    "talk to a broker",
    "broker advisor",
    "billing specialist",
    "payment specialist",
  ]);
}

function isCloseConversationIntent(text: string): boolean {
  return includesAny(text, [
    "close conversation",
    "close this conversation",
    "end conversation",
    "end this conversation",
    "close this chat",
    "end this chat",
    "goodbye",
    "bye",
    "exit",
  ]);
}

function isPolicyIntent(text: string): boolean {
  return includesAny(text, [
    "policy",
    "refund policy",
    "return policy",
    "cancellation policy",
    "cancel policy",
    "refunds",
    "returns",
    "refund",
    "return window",
    "cancellation",
    "cancel",
    "policy documents",
    "documents issued",
    "document delivery",
    "premium adjustment",
    "binding",
    "endorsement",
  ]);
}

function isOrderStatusIntent(text: string): boolean {
  const hasOrderWord = includesAny(text, [
    "order",
    "purchase",
    "request",
    "application",
    "submission",
  ]);
  const hasStatusWord = includesAny(text, [
    "status",
    "tracking",
    "update",
    "shipment",
    "shipping",
    "under review",
    "documents pending",
    "issued",
  ]);

  return hasOrderWord && hasStatusWord;
}

function isAvailabilityIntent(text: string): boolean {
  return includesAny(text, [
    "availability",
    "available",
    "in stock",
    "stock",
    "inventory",
    "do you have",
    "do you carry",
    "carry",
    "have this",
    "have it",
    "eligible",
    "eligibility",
    "broker review",
    "offer",
    "coverage options",
  ]);
}

function isPriceIntent(text: string): boolean {
  return includesAny(text, [
    "price",
    "cost",
    "how much",
    "pricing",
    "premium",
    "estimated premium",
    "monthly premium",
  ]);
}

function isQuoteIntent(text: string): boolean {
  return includesAny(text, [
    "quote",
    "start a quote",
    "get a quote",
    "need a quote",
    "quote request",
    "quote for",
    "new quote",
  ]);
}

function isRenewalIntent(text: string): boolean {
  return includesAny(text, [
    "renewal",
    "renew my policy",
    "policy renewal",
    "renewal status",
    "renewal update",
    "renewal notice",
  ]);
}

function isProductInfoIntent(text: string): boolean {
  return includesAny(text, [
    "product information",
    "information about",
    "details about",
    "details for",
    "tell me about",
    "what can you tell me about",
    "learn about",
    "more about",
    "about this product",
    "about the product",
    "coverage option",
    "coverage options",
    "coverage for",
    "policy option",
    "plan details",
  ]);
}

function isPaymentStatusIntent(text: string): boolean {
  const hasPaymentWord = includesAny(text, [
    "payment",
    "payment id",
    "premium payment",
    "billing payment",
    "paid",
    "charge",
    "transaction",
    "autopay",
  ]);

  const hasStatusWord = includesAny(text, [
    "status",
    "posted",
    "received",
    "processed",
    "pending",
    "failed",
    "declined",
    "settled",
  ]);

  return hasPaymentWord && hasStatusWord;
}

function isPaymentHistoryIntent(text: string): boolean {
  return includesAny(text, [
    "payment history",
    "billing history",
    "recent payments",
    "past payments",
    "payment records",
    "payment activity",
    "billing activity",
  ]);
}

function isPaymentDiscrepancyIntent(text: string): boolean {
  return includesAny(text, [
    "payment discrepancy",
    "billing discrepancy",
    "double charge",
    "duplicate charge",
    "charged twice",
    "payment issue",
    "billing issue",
    "balance mismatch",
    "wrong amount",
    "unexpected charge",
    "reconcile payment",
    "reconciliation",
  ]);
}

function isPolicyStatusIntent(text: string): boolean {
  const hasPolicyWord = includesAny(text, [
    "policy",
    "policy id",
    "coverage",
    "my policy",
  ]);

  const hasStatusWord = includesAny(text, [
    "status",
    "active",
    "inactive",
    "cancelled",
    "canceled",
    "lapsed",
    "in force",
    "bound",
  ]);

  return hasPolicyWord && hasStatusWord;
}

function isPolicyServicingIntent(text: string): boolean {
  return includesAny(text, [
    "billing topic",
    "billing help",
    "billing question",
    "servicing",
    "policy servicing",
    "document delivery",
    "premium adjustment",
    "endorsement",
    "refund timing",
    "refund status",
    "change request",
  ]);
}

function resolveLegacyIntent(text: string): ResolvedIntentResult {
  if (isHumanHandoffIntent(text)) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (isCloseConversationIntent(text)) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (isRenewalIntent(text)) {
    return { intentId: "consult-renewal-status", confidence: "rule" };
  }

  if (isPolicyIntent(text)) {
    return { intentId: "consult-policy", confidence: "rule" };
  }

  if (isOrderStatusIntent(text)) {
    return { intentId: "consult-order-status", confidence: "rule" };
  }

  if (isQuoteIntent(text)) {
    return { intentId: "request-quote", confidence: "rule" };
  }

  if (isPriceIntent(text)) {
    return { intentId: "consult-price", confidence: "rule" };
  }

  if (isAvailabilityIntent(text)) {
    return { intentId: "consult-availability", confidence: "rule" };
  }

  if (isProductInfoIntent(text)) {
    return { intentId: "consult-product", confidence: "rule" };
  }

  return { intentId: "consult-product", confidence: "rule" };
}

function resolvePaymentAuditIntent(text: string): ResolvedIntentResult {
  if (isHumanHandoffIntent(text)) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (isCloseConversationIntent(text)) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (isPaymentDiscrepancyIntent(text)) {
    return { intentId: "explain-payment-discrepancy", confidence: "rule" };
  }

  if (isPaymentHistoryIntent(text)) {
    return { intentId: "consult-payment-history", confidence: "rule" };
  }

  if (isPaymentStatusIntent(text)) {
    return { intentId: "consult-payment-status", confidence: "rule" };
  }

  if (isPolicyStatusIntent(text)) {
    return { intentId: "consult-policy-status", confidence: "rule" };
  }

  if (isPolicyServicingIntent(text)) {
    return { intentId: "consult-policy-servicing", confidence: "rule" };
  }

  return { intentId: "consult-policy-servicing", confidence: "rule" };
}

export function resolveIntentFromTextForContext(
  messageText: string,
  businessContextId: string
): ResolvedIntentResult {
  const text = normalizeText(messageText);

  if (businessContextId === "customer-service-payment-audit-v1") {
    return resolvePaymentAuditIntent(text);
  }

  return resolveLegacyIntent(text);
}

export function resolveIntentFromText(messageText: string): ResolvedIntentResult {
  return resolveIntentFromTextForContext(messageText, "customer-service-core-v2");
}
