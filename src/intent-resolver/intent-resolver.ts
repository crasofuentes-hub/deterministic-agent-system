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

function isOrderStatusIntent(text: string): boolean {
  const hasOrderWord = includesAny(text, ["order", "purchase"]);

  const hasStatusWord = includesAny(text, ["status", "tracking", "update", "shipment", "shipping"]);

  return hasOrderWord && hasStatusWord;
}

function isAvailabilityIntent(text: string): boolean {
  return includesAny(text, ["availability", "available", "in stock", "stock", "inventory"]);
}

function isPriceIntent(text: string): boolean {
  return includesAny(text, ["price", "cost", "how much", "pricing"]);
}

export function resolveIntentFromText(messageText: string): ResolvedIntentResult {
  const text = normalizeText(messageText);

  if (isHumanHandoffIntent(text)) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (isCloseConversationIntent(text)) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (isOrderStatusIntent(text)) {
    return { intentId: "consult-order-status", confidence: "rule" };
  }

  if (isAvailabilityIntent(text)) {
    return { intentId: "consult-availability", confidence: "rule" };
  }

  if (isPriceIntent(text)) {
    return { intentId: "consult-price", confidence: "rule" };
  }

  return { intentId: "consult-product", confidence: "rule" };
}
