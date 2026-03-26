export interface ExtractedEntity {
  entityId: string;
  value: string;
  confidence: "derived";
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

function cleanCapturedValue(value: string): string {
  return normalizeText(value)
    .replace(/^[\s:,-]+/, "")
    .replace(/[\s?!.,;:]+$/g, "")
    .trim();
}

function containsOrderOnlyLanguage(text: string): boolean {
  return /\b(order|purchase|status|tracking|shipment|shipping|orden|pedido|compra|estado|seguimiento|rastreo|envio|envío)\b/i.test(
    text
  );
}

function containsProductLanguage(text: string): boolean {
  return /\b(price|cost|pricing|available|availability|stock|details|information|info|product|precio|cuanto|cuánto|disponible|disponibilidad|detalles|informacion|información|producto)\b/i.test(
    text
  );
}

function extractOrderId(messageText: string): string | undefined {
  const normalized = normalizeText(messageText);

  const explicitOrderId = normalized.match(/\b(ORDER-[A-Z0-9-]+)\b/i);
  if (explicitOrderId?.[1]) {
    return explicitOrderId[1].toUpperCase();
  }

  const patterns = [
    /\b(?:order|purchase)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i,
    /\b(?:orden|pedido|compra)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i,
    /\bstatus\s+of\s+(?:my\s+)?order\s+([A-Z0-9-]{4,})\b/i,
    /\bestado\s+de\s+(?:mi\s+)?(?:orden|pedido)\s+([A-Z0-9-]{4,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const captured = match?.[1];
    if (typeof captured === "string" && captured.trim().length > 0) {
      return normalizeText(captured).toUpperCase();
    }
  }

  return undefined;
}

function extractProductName(messageText: string): string | undefined {
  const normalized = normalizeText(messageText);

  if (containsOrderOnlyLanguage(normalized) && !containsProductLanguage(normalized)) {
    return undefined;
  }

  const patterns = [
    /price\s+of\s+(.+)$/i,
    /cost\s+of\s+(.+)$/i,
    /pricing\s+for\s+(.+)$/i,
    /how\s+much\s+(?:is|does)\s+(.+)$/i,
    /availability\s+of\s+(.+)$/i,
    /is\s+(.+?)\s+available$/i,
    /do\s+you\s+have\s+(.+?)\s+in\s+stock$/i,
    /details\s+about\s+(.+)$/i,
    /information\s+about\s+(.+)$/i,
    /info\s+about\s+(.+)$/i,
    /details\s+for\s+(.+)$/i,
    /looking\s+for\s+(.+)$/i,
    /precio\s+de\s+(.+)$/i,
    /cu[aá]nto\s+cuesta\s+(.+)$/i,
    /cu[aá]nto\s+vale\s+(.+)$/i,
    /disponibilidad\s+de\s+(.+)$/i,
    /tienen\s+disponible\s+(.+)$/i,
    /informaci[oó]n\s+del\s+producto\s+(.+)$/i,
    /informaci[oó]n\s+de\s+(.+)$/i,
    /detalles\s+de\s+(.+)$/i,
    /necesito\s+informaci[oó]n\s+del\s+producto\s+(.+)$/i,
    /quiero\s+informaci[oó]n\s+de\s+(.+)$/i,
    /quiero\s+saber\s+el\s+precio\s+de\s+(.+)$/i,
    /busco\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const captured = match?.[1];
    if (typeof captured === "string") {
      const cleaned = cleanCapturedValue(captured);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }

  if (normalized.length > 0 && normalized.length <= 80 && !containsOrderOnlyLanguage(normalized)) {
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
