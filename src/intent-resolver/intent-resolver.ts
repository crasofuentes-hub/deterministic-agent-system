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
    "quote",
    "premium",
    "estimated premium",
    "monthly premium",
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

export function resolveIntentFromText(messageText: string): ResolvedIntentResult {
  const text = normalizeText(messageText);

  if (isHumanHandoffIntent(text)) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (isCloseConversationIntent(text)) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (isPolicyIntent(text)) {
    return { intentId: "consult-policy", confidence: "rule" };
  }

  if (isOrderStatusIntent(text)) {
    return { intentId: "consult-order-status", confidence: "rule" };
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