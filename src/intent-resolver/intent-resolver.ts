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

  if (includesAny(text, ["humano", "asesor", "agent", "representante"])) {
    return { intentId: "request-human-handoff", confidence: "rule" };
  }

  if (includesAny(text, ["cerrar", "terminar", "finalizar", "adios", "bye"])) {
    return { intentId: "close-conversation", confidence: "rule" };
  }

  if (
    includesAny(text, ["pedido", "orden", "order"]) &&
    includesAny(text, ["estado", "status", "seguimiento"])
  ) {
    return { intentId: "consult-order-status", confidence: "rule" };
  }

  if (includesAny(text, ["disponible", "disponibilidad", "stock", "existencia"])) {
    return { intentId: "consult-availability", confidence: "rule" };
  }

  if (includesAny(text, ["precio", "cuesta", "cost", "vale"])) {
    return { intentId: "consult-price", confidence: "rule" };
  }

  return { intentId: "consult-product", confidence: "rule" };
}