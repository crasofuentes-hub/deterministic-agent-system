export interface ExtractedEntity {
  entityId: string;
  value: string;
  confidence: "derived";
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

function extractOrderId(messageText: string): string | undefined {
  const match = messageText.match(/\b(?:orden|pedido|order)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i);
  return match ? normalizeText(match[1]) : undefined;
}

function extractProductName(messageText: string): string | undefined {
  const normalized = normalizeText(messageText);

  const patterns = [
    /producto\s+(.+)$/i,
    /precio\s+de\s+(.+)$/i,
    /disponibilidad\s+de\s+(.+)$/i,
    /informacion\s+de\s+(.+)$/i,
    /información\s+de\s+(.+)$/i,
    /busco\s+(.+)$/i,
    /necesito\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && normalizeText(match[1]).length > 0) {
      return normalizeText(match[1]);
    }
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