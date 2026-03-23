export interface ExtractedEntity {
  entityId: string;
  value: string;
  confidence: "derived";
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

function extractOrderId(messageText: string): string | undefined {
  const match = messageText.match(/\b(?:order|purchase)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i);
  const captured = match?.[1];
  if (typeof captured !== "string" || captured.trim().length === 0) {
    return undefined;
  }

  return normalizeText(captured);
}

function extractProductName(messageText: string): string | undefined {
  const normalized = normalizeText(messageText);

  const patterns = [
    /price\s+of\s+(.+)$/i,
    /cost\s+of\s+(.+)$/i,
    /availability\s+of\s+(.+)$/i,
    /details\s+about\s+(.+)$/i,
    /information\s+about\s+(.+)$/i,
    /info\s+about\s+(.+)$/i,
    /looking\s+for\s+(.+)$/i,
    /need\s+(.+)$/i,
    /want\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const captured = match?.[1];
    if (typeof captured === "string") {
      const cleaned = normalizeText(captured);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  if (
    normalized.length > 0 &&
    normalized.length <= 80 &&
    !/\b(order|purchase|status|tracking|human|agent|representative|goodbye|bye|close)\b/i.test(normalized)
  ) {
    return normalized;
  }

  return undefined;
}

export function extractEntitiesFromText(messageText: string): ExtractedEntity[] {
  const out: ExtractedEntity[] = [];
  const orderId = extractOrderId(messageText);
  const productName = extractProductName(messageText);

  if (orderId) {
    out.push({
      entityId: "orderId",
      value: orderId,
      confidence: "derived",
    });
  }

  if (productName) {
    out.push({
      entityId: "productName",
      value: productName,
      confidence: "derived",
    });
  }

  return out;
}