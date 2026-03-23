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

export function resolveIntentFromText(messageText: string): ResolvedIntentResult {
  const text = normalizeText(messageText);

  if (
    includesAny(text, [
      "human agent",
      "live agent",
      "customer representative",
      "representative",
      "support agent",
      "speak with someone",
      "talk to someone",
      "talk to an agent",
      "speak with an agent",
      "human support"
    ])
  ) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (
    includesAny(text, [
      "close conversation",
      "end conversation",
      "close this chat",
      "end this chat",
      "goodbye",
      "bye",
      "exit"
    ])
  ) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (
    includesAny(text, ["order", "purchase"]) &&
    includesAny(text, ["status", "tracking", "update"])
  ) {
    return { intentId: "consult-order-status", confidence: "rule" };
  }

  if (
    includesAny(text, [
      "availability",
      "available",
      "in stock",
      "stock",
      "inventory"
    ])
  ) {
    return { intentId: "consult-availability", confidence: "rule" };
  }

  if (
    includesAny(text, [
      "price",
      "cost",
      "how much",
      "pricing"
    ])
  ) {
    return { intentId: "consult-price", confidence: "rule" };
  }

  return { intentId: "consult-product", confidence: "rule" };
}