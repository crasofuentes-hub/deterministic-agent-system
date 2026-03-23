export interface GoalEntities {
  productName?: string;
  orderId?: string;
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

function extractOrderId(goal: string): string | undefined {
  const match = goal.match(/\b(?:order|purchase)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i);
  const captured = match?.[1];
  if (typeof captured !== "string" || captured.trim().length === 0) {
    return undefined;
  }

  return normalizeText(captured);
}

function extractProductName(goal: string): string | undefined {
  const normalized = normalizeText(goal);

  const patterns = [
    /price\s+of\s+(.+?)(?:\?|$)/i,
    /cost\s+of\s+(.+?)(?:\?|$)/i,
    /availability\s+of\s+(.+?)(?:\?|$)/i,
    /details\s+about\s+(.+?)(?:\?|$)/i,
    /information\s+about\s+(.+?)(?:\?|$)/i,
    /info\s+about\s+(.+?)(?:\?|$)/i,
    /looking\s+for\s+(.+?)(?:\?|$)/i,
    /need\s+(.+?)(?:\?|$)/i,
    /want\s+(.+?)(?:\?|$)/i,
    /is\s+(.+?)\s+in\s+stock(?:\?|$)/i
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

  return undefined;
}

export function extractGoalEntities(goal: string): GoalEntities {
  return {
    productName: extractProductName(goal),
    orderId: extractOrderId(goal),
  };
}