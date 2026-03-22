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

function buildResolvedResponse(
  resolvedIntentId: string,
  session: SessionState
): string | undefined {
  if (resolvedIntentId === "consult-price") {
    const productName = findEntityValue(session, "productName");
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
      " | Price: " +
      product.price.toFixed(2) +
      " " +
      product.currency
    );
  }

  if (resolvedIntentId === "consult-availability") {
    const productName = findEntityValue(session, "productName");
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
    const productName = findEntityValue(session, "productName");
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
    const orderId = findEntityValue(session, "orderId");
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
  const resolvedIntent = resolveIntentFromText(params.userMessageText);

  let nextSession = params.session;
  const extractedEntities = extractEntitiesFromText(params.userMessageText);

  for (const entity of extractedEntities) {
    nextSession = upsertSessionEntity(nextSession, entity);
  }

  const result = orchestrateConversationTurn({
    pack,
    session: nextSession,
    intentId: resolvedIntent.intentId,
  });

  const resolvedResponseText = buildResolvedResponse(
    result.intentId,
    result.session
  );

  return {
    session: result.session,
    resolvedIntentId: result.intentId,
    responseText: resolvedResponseText ?? result.responseText,
    responseId: result.responseId,
    stage: result.stage,
    status: result.status,
  };
}