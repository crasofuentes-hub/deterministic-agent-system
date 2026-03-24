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
  const cleaned = normalizeLooseEntityText(value);
  if (cleaned.length === 0) {
    return undefined;
  }

  const lowered = cleaned.toLowerCase();
  const blocked = new Set([
    "product",
    "a product",
    "an item",
    "item",
    "information about a product",
    "i want information about a product",
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

  if (/(order status|tracking|shipment|shipping|\border\b)/.test(lowered)) {
    return undefined;
  }

  if (
    /(information|info|details)/.test(lowered) &&
    /(product|item)/.test(lowered) &&
    !/[a-z0-9]+(?:\s+[a-z0-9]+){1,}/i.test(
      cleaned
        .replace(/\b(product|item|information|info|details|about|a|an|the|want|i)\b/gi, "")
        .trim()
    )
  ) {
    return undefined;
  }

  return cleaned;
}

function sanitizeOrderIdCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toUpperCase();
  if (cleaned.length === 0) {
    return undefined;
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
    return /close|end conversation|finish conversation/.test(text);
  }

  if (intentId === "consult-order-status") {
    return /order|status|tracking|shipment|shipping/.test(text);
  }

  if (intentId === "consult-price") {
    return /price|cost|how much/.test(text);
  }

  if (intentId === "consult-availability") {
    return /in stock|available|availability|stock/.test(text);
  }

  if (intentId === "consult-product") {
    return /product|details|information|info|item/.test(text);
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
      return "The order was not found.";
    }

    return (
      "Order ID: " +
      order.orderId +
      " | Status: " +
      order.status +
      " | Updated: " +
      order.updatedAtIso
    );
  }

  return undefined;
}

export function runCustomerServiceAgent(params: {
  session: SessionState;
  userMessageText: string;
}): CustomerServiceAgentResult {
  const pack = loadCustomerServicePack();
  const effectiveIntentId = resolveEffectiveIntentId(params.session, params.userMessageText);

  let nextSession = params.session;
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

  const result = orchestrateConversationTurn({
    pack,
    session: nextSession,
    intentId: effectiveIntentId,
  });

  const resolvedResponseText = buildResolvedResponse(result.intentId, result.session);

  return {
    session: result.session,
    resolvedIntentId: result.intentId,
    responseText: resolvedResponseText ?? result.responseText,
    responseId: result.responseId,
    stage: result.stage,
    status: result.status,
  };
}
