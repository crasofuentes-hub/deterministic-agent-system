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
    .replace(/^for\s+/i, "")
    .replace(/[\s?!.,;:]+$/g, "")
    .trim();
}

function containsOrderOnlyLanguage(text: string): boolean {
  return /\b(order|purchase|request|application|submission|status|tracking|shipment|shipping)\b/i.test(
    text
  );
}

function containsProductLanguage(text: string): boolean {
  return /\b(price|cost|pricing|premium|quote|available|availability|eligibility|details|information|info|product|coverage)\b/i.test(
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
    /\b(?:order|purchase|request|application)\s*(?:id)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i,
    /\bstatus\s+of\s+(?:my\s+)?(?:order|request|application)\s+([A-Z0-9-]{4,})\b/i,
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

function extractPolicyTopic(messageText: string): string | undefined {
  const normalized = normalizeText(messageText).toLowerCase();

  if (
    /\breturn policy\b/.test(normalized) ||
    /\breturns\b/.test(normalized) ||
    /\breturn window\b/.test(normalized) ||
    /\bpolicy documents\b/.test(normalized) ||
    /\bdocument delivery\b/.test(normalized) ||
    /\bdocuments issued\b/.test(normalized)
  ) {
    return "return-policy";
  }

  if (
    /\brefund policy\b/.test(normalized) ||
    /\brefunds\b/.test(normalized) ||
    /\brefund\b/.test(normalized) ||
    /\brefund timing\b/.test(normalized) ||
    /\bpremium adjustment\b/.test(normalized)
  ) {
    return "refund-policy";
  }

  if (
    /\bcancellation policy\b/.test(normalized) ||
    /\bcancel policy\b/.test(normalized) ||
    /\bcancellation\b/.test(normalized) ||
    /\bcancel order\b/.test(normalized) ||
    /\bcancel an order\b/.test(normalized) ||
    /\bcancel my order\b/.test(normalized) ||
    /\bcancel.*shipment\b/.test(normalized) ||
    /\bcancel before binding\b/.test(normalized) ||
    /\bbinding\b/.test(normalized) ||
    /\bpolicy change\b/.test(normalized) ||
    /\bchange my policy\b/.test(normalized) ||
    /\brequest a policy change\b/.test(normalized) ||
    /\bendorsement\b/.test(normalized) ||
    /\bupdate my policy\b/.test(normalized)
  ) {
    return "cancellation-policy";
  }

  return undefined;
}

function extractPolicyAspect(messageText: string): string | undefined {
  const normalized = normalizeText(messageText).toLowerCase();

  if (
    /\bhow many days\b/.test(normalized) ||
    /\breturn window\b/.test(normalized) ||
    /\bwithin how many days\b/.test(normalized)
  ) {
    return "return-window";
  }

  if (
    /\bwhen will.*documents\b/.test(normalized) ||
    /\bdocument delivery status\b/.test(normalized) ||
    /\bpolicy document status\b/.test(normalized) ||
    /\bcheck document delivery\b/.test(normalized)
  ) {
    return "document-delivery-status";
  }

  if (
    /\bhow long\b.*\brefund/.test(normalized) ||
    /\brefund timing\b/.test(normalized) ||
    /\bwhen.*refund/.test(normalized)
  ) {
    return "refund-timing";
  }

  if (
    /\bpremium adjustment request\b/.test(normalized) ||
    /\brequest a premium adjustment\b/.test(normalized) ||
    /\bhow do i request a premium adjustment\b/.test(normalized) ||
    /\bpremium adjustment\b/.test(normalized)
  ) {
    return "premium-adjustment-guidance";
  }

  if (
    /\bpolicy change\b/.test(normalized) ||
    /\bchange my policy\b/.test(normalized) ||
    /\brequest a policy change\b/.test(normalized) ||
    /\bendorsement\b/.test(normalized) ||
    /\bupdate my policy\b/.test(normalized)
  ) {
    return "endorsement-guidance";
  }

  if (
    /\bcan i cancel\b/.test(normalized) ||
    /\bcancel after shipment\b/.test(normalized) ||
    /\bcancel before shipment\b/.test(normalized) ||
    /\bcancel before binding\b/.test(normalized) ||
    /\bcancellation eligibility\b/.test(normalized)
  ) {
    return "cancellation-eligibility";
  }

  return undefined;
}

function isGenericProductReference(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "it" ||
    normalized === "it cost" ||
    normalized === "it costs" ||
    normalized === "this" ||
    normalized === "that" ||
    normalized === "this product" ||
    normalized === "that product" ||
    normalized === "this coverage" ||
    normalized === "that coverage"
  );
}

function extractProductName(messageText: string): string | undefined {
  const normalized = normalizeText(messageText);

  if (containsOrderOnlyLanguage(normalized) && !containsProductLanguage(normalized)) {
    return undefined;
  }

  const eligibilityMatch = normalized.match(/^is\s+(.+?)\s+(?:available|eligible|broker\s+review)\??$/i);
  if (eligibilityMatch?.[1]) {
    const cleaned = cleanCapturedValue(eligibilityMatch[1]);
    if (cleaned.length > 0 && !isGenericProductReference(cleaned)) {
      return cleaned;
    }
  }

  const patterns = [
    /price\s+of\s+(.+)$/i,
    /cost\s+of\s+(.+)$/i,
    /pricing\s+for\s+(.+)$/i,
    /premium\s+for\s+(.+)$/i,
    /quote\s+for\s+(.+)$/i,
    /how\s+much\s+(?:is|does)\s+(.+)$/i,
    /availability\s+of\s+(.+)$/i,
    /eligibility\s+for\s+(.+)$/i,
    /coverage\s+for\s+(.+)$/i,
    /coverage\s+options\s+do\s+you\s+offer\s+for\s+(.+)$/i,
    /is\s+(.+?)\s+available$/i,
    /is\s+(.+?)\s+eligible$/i,
    /is\s+(.+?)\s+broker\s+review$/i,
    /is\s+(.+?)\s+(?:available|eligible)$/i,
    /do\s+you\s+have\s+(.+?)$/i,
    /do\s+you\s+offer\s+(.+?)$/i,
    /do\s+you\s+carry\s+(.+)$/i,
    /details\s+about\s+(.+)$/i,
    /information\s+about\s+(.+)$/i,
    /info\s+about\s+(.+)$/i,
    /details\s+for\s+(.+)$/i,
    /looking\s+for\s+(.+)$/i,
    /what\s+can\s+you\s+tell\s+me\s+about\s+(.+?)\s+pricing$/i,
    /what\s+can\s+you\s+tell\s+me\s+about\s+(.+)$/i,
    /can\s+you\s+tell\s+me\s+about\s+(.+)$/i,
    /product\s+information\s+about\s+(.+)$/i,
    /coverage\s+option\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const captured = match?.[1];
    if (typeof captured === "string") {
      const cleaned = cleanCapturedValue(captured);
      if (cleaned.length > 0 && !isGenericProductReference(cleaned)) {
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
  const policyTopic = extractPolicyTopic(messageText);
  const policyAspect = extractPolicyAspect(messageText);
  const productName = extractProductName(messageText);

  if (orderId) {
    out.push({
      entityId: "orderId",
      value: orderId,
      confidence: "derived",
    });
  }

  if (policyTopic) {
    out.push({
      entityId: "policyTopic",
      value: policyTopic,
      confidence: "derived",
    });
  }

  if (policyAspect) {
    out.push({
      entityId: "policyAspect",
      value: policyAspect,
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