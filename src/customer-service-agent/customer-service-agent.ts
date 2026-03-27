import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../business-context/context-pack";
import { orchestrateConversationTurn } from "../conversation-orchestrator/conversation-orchestrator";
import { findKnowledgeByProductName } from "../data-layer/knowledge-base-repository";
import { findOrderById } from "../data-layer/order-repository";
import { findProductByName } from "../data-layer/product-repository";
import { extractEntitiesFromText } from "../entity-extractor/entity-extractor";
import { resolveIntentFromText } from "../intent-resolver/intent-resolver";
import type { SessionState } from "../session-state/session-state";
import { upsertSessionEntity } from "../session-state/session-state";

export interface CustomerServiceAgentResult {
  session: SessionState;
  resolvedIntentId: string;
  responseText: string;
  responseId: string;
  stage: string;
  status: string;
}

function loadCustomerServicePack(): BusinessContextPack {
  const filePath = path.resolve(
    process.cwd(),
    "config/business-context/customer-service-core.json"
  );

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as BusinessContextPack;
}

function findEntityValue(session: SessionState, entityId: string): string | undefined {
  return session.collectedEntities.find((item) => item.entityId === entityId)?.value;
}

function normalizeLooseEntityText(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/[?!.,;:]+$/g, "")
    .trim();
}

function sanitizeProductNameCandidate(value: string): string | undefined {
  let cleaned = normalizeLooseEntityText(value);

  cleaned = cleaned
    .replace(/^what is the price of\s+/i, "")
    .replace(/^what's the price of\s+/i, "")
    .replace(/^i want to know the price of\s+/i, "")
    .replace(/^price of\s+/i, "")
    .replace(/^pricing for\s+/i, "")
    .replace(/^how much does\s+/i, "")
    .replace(/\s+costs?$/i, "")
    .replace(/^availability of\s+/i, "")
    .replace(/^is\s+/i, "")
    .replace(/\s+available$/i, "")
    .replace(/\s+in stock$/i, "")
    .replace(/^do you have\s+/i, "")
    .replace(/^do you carry\s+/i, "")
    .replace(/^product information about\s+/i, "")
    .replace(/^information about\s+/i, "")
    .replace(/^details about\s+/i, "")
    .replace(/^details for\s+/i, "")
    .replace(/^i need product information about\s+/i, "")
    .replace(/^i need information about\s+/i, "")
    .replace(/^i need\s+/i, "")
    .replace(/^i want information about\s+/i, "")
    .replace(/^can you tell me about\s+/i, "")
    .replace(/^what can you tell me about\s+/i, "")
    .replace(/\s+pricing$/i, "")
    .trim();

  if (cleaned.length === 0) {
    return undefined;
  }

  const lowered = cleaned.toLowerCase();
  const blocked = new Set([
    "product",
    "a product",
    "an item",
    "item",
    "it",
    "it cost",
    "it costs",
    "this",
    "that",
    "this product",
    "that product",
    "information about a product",
    "i want information about a product",
    "i need product information",
    "i need information about a product",
    "info about a product",
    "details about a product",
    "about a product",
    "product information",
    "information about product",
    "details about product",
  ]);

  if (blocked.has(lowered)) {
    return undefined;
  }

  return cleaned;
}

function sanitizeOrderIdCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toUpperCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  const explicitOrderId = cleaned.match(/\b(ORDER-[A-Z0-9-]+)\b/i);
  if (explicitOrderId?.[1]) {
    return explicitOrderId[1].toUpperCase();
  }

  const blocked = new Set(["ORDER", "PURCHASE", "STATUS", "TRACKING", "UPDATE"]);

  if (blocked.has(cleaned)) {
    return undefined;
  }

  if (!/^[A-Z0-9][A-Z0-9-]{3,}$/.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function hasMalformedOrderIdSignal(userMessageText: string): boolean {
  const cleaned = normalizeLooseEntityText(userMessageText).toUpperCase();

  if (!/\bORDER\b/.test(cleaned)) {
    return false;
  }

  if (sanitizeOrderIdCandidate(cleaned)) {
    return false;
  }

  return /[A-Z0-9]/.test(cleaned);
}

function getAllowedEntityIdsForIntent(intentId: string): string[] {
  if (intentId === "consult-price") {
    return ["productName"];
  }

  if (intentId === "consult-availability") {
    return ["productName"];
  }

  if (intentId === "consult-product") {
    return ["productName"];
  }

  if (intentId === "consult-order-status") {
    return ["orderId"];
  }

  return [];
}

function retainEntitiesCompatibleWithIntent(session: SessionState, intentId: string): SessionState {
  const allowed = new Set(getAllowedEntityIdsForIntent(intentId));

  return {
    ...session,
    collectedEntities: session.collectedEntities.filter((item) => allowed.has(item.entityId)),
  };
}

function hasExplicitIntentSignal(userMessageText: string, intentId: string): boolean {
  const text = userMessageText.trim().toLowerCase();

  if (intentId === "request-human-handoff") {
    return /human|agent|representative|person/.test(text);
  }

  if (intentId === "close-conversation") {
    return /close|end conversation|finish conversation|goodbye|bye|exit/.test(text);
  }

  if (intentId === "consult-order-status") {
    return /order|status|tracking|shipment|shipping|purchase/.test(text);
  }

  if (intentId === "consult-price") {
    return /price|cost|how much|pricing|quote/.test(text);
  }

  if (intentId === "consult-availability") {
    return /in stock|available|availability|stock|inventory|do you have|do you carry/.test(text);
  }

  if (intentId === "consult-product") {
    return /product|details|information|info|tell me about|what can you tell me about/.test(text);
  }

  return false;
}

function resolveEffectiveIntentId(session: SessionState, userMessageText: string): string {
  const resolved = resolveIntentFromText(userMessageText).intentId;

  if (
    session.conversationStatus === "waiting-user" &&
    typeof session.currentIntentId === "string" &&
    session.currentIntentId.trim().length > 0
  ) {
    const currentIntentId = session.currentIntentId;

    if (resolved === currentIntentId) {
      return currentIntentId;
    }

    if (hasExplicitIntentSignal(userMessageText, resolved)) {
      return resolved;
    }

    return currentIntentId;
  }

  return resolved;
}

function buildResolvedResponse(
  resolvedIntentId: string,
  session: SessionState
): string | undefined {
  if (resolvedIntentId === "consult-price") {
    const productName = sanitizeProductNameCandidate(findEntityValue(session, "productName") ?? "");
    if (!productName) {
      return undefined;
    }

    const product = findProductByName(productName);
    if (!product) {
      return "The product was not found.";
    }

    return (
      "Product: " + product.name + " | Price: " + product.price.toFixed(2) + " " + product.currency
    );
  }

  if (resolvedIntentId === "consult-availability") {
    const productName = sanitizeProductNameCandidate(findEntityValue(session, "productName") ?? "");
    if (!productName) {
      return undefined;
    }

    const product = findProductByName(productName);
    if (!product) {
      return "The product was not found.";
    }

    return (
      "Product: " +
      product.name +
      " | Availability: " +
      product.availability +
      " | Stock: " +
      String(product.stockQuantity)
    );
  }

  if (resolvedIntentId === "consult-product") {
    const productName = sanitizeProductNameCandidate(findEntityValue(session, "productName") ?? "");
    if (!productName) {
      return undefined;
    }

    const product = findProductByName(productName);
    if (!product) {
      return "The product was not found.";
    }

    const knowledge = findKnowledgeByProductName(productName);

    return (
      "Product: " +
      product.name +
      " | SKU: " +
      product.sku +
      " | Price: " +
      product.price.toFixed(2) +
      " " +
      product.currency +
      " | Availability: " +
      product.availability +
      (knowledge ? " | Summary: " + knowledge.summary : "")
    );
  }

  if (resolvedIntentId === "consult-order-status") {
    const orderId = sanitizeOrderIdCandidate(findEntityValue(session, "orderId") ?? "");
    if (!orderId) {
      return undefined;
    }

    const order = findOrderById(orderId);
    if (!order) {
      return "I could not find an order with the provided order ID. Please verify the order ID and try again.";
    }

    return (
      "Order " +
      order.orderId +
      " is currently " +
      order.status +
      ". Last update: " +
      order.updatedAtIso +
      ". No additional action is required at this time."
    );
  }

  return undefined;
}

export function runCustomerServiceAgent(params: {
  session: SessionState;
  userMessageText: string;
}): CustomerServiceAgentResult {
  const pack = loadCustomerServicePack();
  const previousIntentId =
    typeof params.session.currentIntentId === "string" ? params.session.currentIntentId : undefined;
  const effectiveIntentId = resolveEffectiveIntentId(params.session, params.userMessageText);

  let nextSession = params.session;

  if (
    params.session.conversationStatus === "waiting-user" &&
    previousIntentId &&
    previousIntentId !== effectiveIntentId
  ) {
    nextSession = retainEntitiesCompatibleWithIntent(nextSession, effectiveIntentId);
  }

  const extractedEntities = extractEntitiesFromText(params.userMessageText);

  for (const entity of extractedEntities) {
    let sanitizedValue: string | undefined;

    if (entity.entityId === "productName") {
      sanitizedValue = sanitizeProductNameCandidate(entity.value);
    } else if (entity.entityId === "orderId") {
      sanitizedValue = sanitizeOrderIdCandidate(entity.value);
    } else {
      sanitizedValue = normalizeLooseEntityText(entity.value);
    }

    if (!sanitizedValue) {
      continue;
    }

    nextSession = upsertSessionEntity(nextSession, {
      ...entity,
      value: sanitizedValue,
    });
  }

  const hasInvalidOrderIdAttempt =
    effectiveIntentId === "consult-order-status" &&
    !findEntityValue(nextSession, "orderId") &&
    hasMalformedOrderIdSignal(params.userMessageText);

  const result = orchestrateConversationTurn({
    pack,
    session: nextSession,
    intentId: effectiveIntentId,
  });

  const resolvedResponseText = buildResolvedResponse(result.intentId, result.session);

  if (
    hasInvalidOrderIdAttempt &&
    result.intentId === "consult-order-status" &&
    result.status === "missing-entity"
  ) {
    return {
      session: result.session,
      resolvedIntentId: result.intentId,
      responseText:
        "The provided order ID format is invalid. Please provide a valid order ID and try again.",
      responseId: result.responseId,
      stage: result.stage,
      status: result.status,
    };
  }

  return {
    session: result.session,
    resolvedIntentId: result.intentId,
    responseText: resolvedResponseText ?? result.responseText,
    responseId: result.responseId,
    stage: result.stage,
    status: result.status,
  };
}
