import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../business-context/context-pack";
import { orchestrateConversationTurn } from "../conversation-orchestrator/conversation-orchestrator";
import { findKnowledgeByProductName } from "../data-layer/knowledge-base-repository";
import { findOrderById } from "../data-layer/order-repository";
import { findPolicyByTopic } from "../data-layer/policy-repository";
import {
  findLatestPaymentAuditRecordByPolicyId,
  findPaymentAuditRecordByPaymentId,
  listPaymentAuditRecordsByCustomerId,
  listPaymentAuditRecordsByDiscrepancyType,
  listPaymentAuditRecordsByPolicyId,
} from "../data-layer/payment-audit-repository";
import { findProductByName } from "../data-layer/product-repository";
import { extractEntitiesFromText } from "../entity-extractor/entity-extractor";
import { resolveIntentFromTextForContext } from "../intent-resolver/intent-resolver";
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

function loadCustomerServicePackByContextId(businessContextId: string): BusinessContextPack {
  const fileName =
    businessContextId === "customer-service-payment-audit-v1"
      ? "customer-service-payment-audit.json"
      : "customer-service-core.json";

  const filePath = path.resolve(process.cwd(), "config/business-context", fileName);

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
    "quote",
    "a quote",
    "get a quote",
    "can i get a quote",
    "i need a quote",
    "need a quote",
    "start a quote",
    "quote request",
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
    "what is the price",
    "what's the price",
    "the price",
    "price",
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

  if (!/^ORDER-[A-Z0-9]+$/.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function sanitizePolicyTopicCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toLowerCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (
    cleaned === "return-policy" ||
    cleaned === "refund-policy" ||
    cleaned === "cancellation-policy"
  ) {
    return cleaned;
  }

  if (
    cleaned.indexOf("-") >= 0 &&
    cleaned !== "return-policy" &&
    cleaned !== "refund-policy" &&
    cleaned !== "cancellation-policy"
  ) {
    return cleaned;
  }

  if (
    cleaned.includes("document") ||
    cleaned.includes("return")
  ) {
    return "return-policy";
  }

  if (
    cleaned.includes("refund") ||
    cleaned.includes("premium adjustment")
  ) {
    return "refund-policy";
  }

  if (
    cleaned.includes("cancel") ||
    cleaned.includes("binding") ||
    cleaned.includes("endorsement") ||
    cleaned.includes("policy change") ||
    cleaned.includes("change request")
  ) {
    return "cancellation-policy";
  }

  return cleaned;
}

function sanitizePolicyAspectCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toLowerCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.includes("refund")) {
    return "refund-timing";
  }

  if (cleaned.includes("document")) {
    return "document-delivery-status";
  }

  if (cleaned.includes("premium")) {
    return "premium-adjustment-guidance";
  }

  if (cleaned.includes("endorsement") || cleaned.includes("change")) {
    return "endorsement-guidance";
  }

  if (cleaned.includes("cancel")) {
    return "cancellation-eligibility";
  }

  return "summary";
}

function sanitizePaymentIdCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toUpperCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (!/^PMT-[A-Z0-9]+$/.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function sanitizePolicyIdCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toUpperCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (!/^POL-[A-Z0-9]+$/.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function sanitizeCustomerIdCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toUpperCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (!/^CUS-[A-Z0-9]+$/.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function sanitizeBillingTopicCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toLowerCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.includes("document")) {
    return "document-delivery";
  }

  if (cleaned.includes("refund")) {
    return "refund-timing";
  }

  if (cleaned.includes("premium")) {
    return "premium-adjustment";
  }

  if (cleaned.includes("endorsement")) {
    return "endorsement";
  }

  if (cleaned.includes("billing")) {
    return "billing-review";
  }

  return cleaned;
}

function sanitizeDiscrepancyTypeCandidate(value: string): string | undefined {
  const cleaned = normalizeLooseEntityText(value).toLowerCase();

  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.includes("double") || cleaned.includes("twice") || cleaned.includes("duplicate")) {
    return "duplicate-charge";
  }

  if (cleaned.includes("wrong amount") || cleaned.includes("amount")) {
    return "amount-mismatch";
  }

  if (cleaned.includes("balance")) {
    return "balance-mismatch";
  }

  return cleaned;
}

function hasMalformedOrderIdSignal(userMessageText: string): boolean {
  const raw = String(userMessageText).normalize("NFC").trim().toUpperCase();

  if (sanitizeOrderIdCandidate(raw)) {
    return false;
  }

  return (
    /\bORDER\s*[-:#]\s*[A-Z0-9?]+/.test(raw) ||
    /\bORDER\s+ID\s*[-:#]?\s*[A-Z0-9?]+/.test(raw)
  );
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

  if (intentId === "consult-policy") {
    return ["policyTopic", "policyAspect"];
  }

  if (intentId === "consult-payment-status") {
    return ["paymentId", "policyId", "customerId"];
  }

  if (intentId === "consult-payment-history") {
    return ["customerId", "policyId"];
  }

  if (intentId === "explain-payment-discrepancy") {
    return ["paymentId", "policyId", "customerId", "discrepancyType"];
  }

  if (intentId === "consult-policy-status") {
    return ["policyId", "customerId"];
  }

  if (intentId === "consult-policy-servicing") {
    return ["billingTopic", "policyId", "customerId"];
  }

  if (intentId === "request-quote") {
    return ["productName", "stateCode", "vehicleUse", "priorInsuranceStatus", "contactPreference"];
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
    return /human|agent|representative|person|billing specialist|payment specialist/.test(text);
  }

  if (intentId === "close-conversation") {
    return /close|end conversation|finish conversation|goodbye|bye|exit/.test(text);
  }

  if (intentId === "consult-policy") {
    return /policy|refund|return|cancellation|cancel/.test(text);
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
    if (/product|details|information|info|tell me about|what can you tell me about/.test(text)) {
      return true;
    }

    return extractEntitiesFromText(userMessageText).some(
      (entity) => entity.entityId === "productName"
    );
  }

  if (intentId === "consult-payment-status") {
    return /payment|payment id|paid|charge|transaction|autopay|status|processed|pending/.test(text);
  }

  if (intentId === "consult-payment-history") {
    return /payment history|billing history|recent payments|past payments|payment records/.test(text);
  }

  if (intentId === "explain-payment-discrepancy") {
    return /discrepancy|charged twice|double charge|duplicate charge|billing issue|reconciliation/.test(text);
  }

  if (intentId === "consult-policy-status") {
    return /policy|active|inactive|cancelled|canceled|lapsed|in force|bound|status/.test(text);
  }

  if (intentId === "consult-policy-servicing") {
    return /billing|servicing|document delivery|premium adjustment|endorsement|refund timing|change request/.test(text);
  }

  return false;
}

function resolveEffectiveIntentId(session: SessionState, userMessageText: string): string {
  const businessContextId =
    typeof session.businessContextId === "string" && session.businessContextId.trim().length > 0
      ? session.businessContextId
      : "customer-service-core-v2";

  const resolved = resolveIntentFromTextForContext(userMessageText, businessContextId).intentId;

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

  if (session.currentIntentId === "request-quote") {
    const collectedProductName = findEntityValue(session, "productName");
    const collectedStateCode = findEntityValue(session, "stateCode");
    const collectedVehicleUse = findEntityValue(session, "vehicleUse");
    const collectedPriorInsuranceStatus = findEntityValue(session, "priorInsuranceStatus");
    const extracted = extractEntitiesFromText(userMessageText);

    const hasQuoteFollowUpSignal = extracted.some(
      (entity) =>
        entity.entityId === "stateCode" ||
        entity.entityId === "vehicleUse" ||
        entity.entityId === "priorInsuranceStatus" ||
        entity.entityId === "contactPreference"
    );

    if (
      typeof collectedProductName === "string" &&
      collectedProductName.trim().length > 0 &&
      (
        !collectedStateCode ||
        collectedStateCode.trim().length === 0 ||
        !collectedVehicleUse ||
        collectedVehicleUse.trim().length === 0 ||
        !collectedPriorInsuranceStatus ||
        collectedPriorInsuranceStatus.trim().length === 0
      ) &&
      hasQuoteFollowUpSignal &&
      !hasExplicitIntentSignal(userMessageText, resolved)
    ) {
      return "request-quote";
    }
  }

  return resolved;
}

function buildResolvedResponse(
  resolvedIntentId: string,
  session: SessionState
): string | undefined {
  if (resolvedIntentId === "consult-coverage") {
    const rawProductName = findEntityValue(session, "productName") ?? "";
    const normalizedCoverage = String(rawProductName)
      .normalize("NFC")
      .trim()
      .replace(/[?!.]+$/g, "")
      .trim();

    if (/^(?:what does this cover|what does it cover|what is covered)$/i.test(normalizedCoverage)) {
      return "Coverage review started. Please provide the coverage option name so I can explain what is included.";
    }

    let productName = sanitizeProductNameCandidate(rawProductName);

    if (productName) {
      productName = productName
        .replace(/^(?:does|do)\s+/i, "")
        .replace(/\s+\bcover(?:s|ed)?\b.*$/i, "")
        .trim();
    }

    if (!productName && /\bdoes\b.*\bcover\b/i.test(normalizedCoverage)) {
      productName = normalizedCoverage
        .replace(/^(?:does|do)\s+/i, "")
        .replace(/\s+\bcover(?:s|ed)?\b.*$/i, "")
        .trim();
    }

    if (productName) {
      return (
        "Coverage summary for " +
        productName +
        ": standard protections are included, while final covered scenarios remain subject to underwriting and policy terms."
      );
    }

    return "Coverage review started. Please provide the coverage option name so I can explain what is included.";
  }

  if (resolvedIntentId === "consult-renewal-status") {
    const rawProductName = findEntityValue(session, "productName") ?? "";
    const orderId = sanitizeOrderIdCandidate(findEntityValue(session, "orderId") ?? "");

    let productName = sanitizeProductNameCandidate(rawProductName);

    if (productName) {
      productName = productName
        .replace(/^(?:a\s+)?renewal\s+(?:update|status)\s+(?:for|of)\s+/i, "")
        .trim();
    }

    if (!productName) {
      const normalizedRenewal = String(rawProductName)
        .normalize("NFC")
        .trim()
        .replace(/^(?:i need|need|want|looking for)\s+(?:a\s+)?renewal\s+(?:update|status)\s+(?:for|of)\s+/i, "")
        .replace(/^(?:a\s+)?renewal\s+(?:update|status)\s+(?:for|of)\s+/i, "")
        .replace(/[?!.]+$/g, "")
        .trim();

      if (
        normalizedRenewal.length > 0 &&
        normalizedRenewal.toLowerCase() !== "my policy" &&
        normalizedRenewal.toLowerCase() !== "policy"
      ) {
        productName = normalizedRenewal;
      }
    }

    if (orderId) {
      return (
        "Renewal case " +
        orderId +
        " is currently under broker review. No additional customer action is required at this time."
      );
    }

    if (productName) {
      return (
        "Renewal status for " +
        productName +
        ": the policy is currently in renewal review. Updated premium and eligibility guidance can now be prepared."
      );
    }

    return "Renewal status check started. Please provide the coverage option name or renewal request ID so I can continue.";
  }

  if (resolvedIntentId === "request-quote") {
    const rawProductName = findEntityValue(session, "productName") ?? "";
    let productName = sanitizeProductNameCandidate(rawProductName);
    let stateCode = findEntityValue(session, "stateCode")?.trim().toUpperCase();
    let vehicleUse = findEntityValue(session, "vehicleUse")?.trim().toLowerCase();
    let priorInsuranceStatus = findEntityValue(session, "priorInsuranceStatus")?.trim().toLowerCase();
    let contactPreference = findEntityValue(session, "contactPreference")?.trim().toLowerCase();

    const normalizedQuote = String(rawProductName)
      .normalize("NFC")
      .trim()
      .replace(/[?!.]+$/g, "")
      .trim();

    if (productName) {
      productName = productName
        .replace(/\s+\bin\s+(?:CA|TX|AZ|NV|NM|CO|UT|OR|WA|FL)\b.*$/i, "")
        .replace(/\s+\bin\s+(?:California|Texas|Arizona|Nevada|New Mexico|Colorado|Utah|Oregon|Washington|Florida)\b.*$/i, "")
        .replace(/,\s*(?:call me|call back|text me|email me|sms)\s*$/i, "")
        .trim();
    }

    if (!stateCode) {
      const directStateMatch = normalizedQuote.match(/\bin\s+(CA|TX|AZ|NV|NM|CO|UT|OR|WA|FL)\b/i);
      if (directStateMatch?.[1]) {
        stateCode = directStateMatch[1].toUpperCase();
      }
    }

    if (!contactPreference) {
      if (/\bcall me\b|\bcall back\b|\bphone call\b/i.test(normalizedQuote)) {
        contactPreference = "call";
      } else if (/\btext me\b|\bsms\b|\btext message\b/i.test(normalizedQuote)) {
        contactPreference = "text";
      } else if (/\bemail me\b|\bemail\b/i.test(normalizedQuote)) {
        contactPreference = "email";
      }
    }

    if (!vehicleUse) {
      if (/\brideshare\b|\buber\b|\blyft\b|\bdelivery\b/i.test(normalizedQuote)) {
        vehicleUse = "rideshare";
      } else if (/\bbusiness use\b|\bwork vehicle\b|\bcommercial use\b/i.test(normalizedQuote)) {
        vehicleUse = "business";
      } else if (/\bcommute\b|\bcommuting\b|\bdrive to work\b|\bwork commute\b/i.test(normalizedQuote)) {
        vehicleUse = "commute";
      } else if (/\bpersonal use\b|\bpersonal vehicle\b|\bpleasure\b/i.test(normalizedQuote)) {
        vehicleUse = "personal";
      }
    }

    if (!priorInsuranceStatus) {
      if (/\blapsed\b|\bcoverage lapsed\b|\bpolicy lapsed\b|\binsurance lapsed\b/i.test(normalizedQuote)) {
        priorInsuranceStatus = "lapsed";
      } else if (/\bcurrently uninsured\b|\bno prior insurance\b|\bno insurance\b|\bnot insured\b/i.test(normalizedQuote)) {
        priorInsuranceStatus = "uninsured";
      } else if (/\bcurrently insured\b|\balready insured\b|\bhave insurance\b|\binsured\b/i.test(normalizedQuote)) {
        priorInsuranceStatus = "insured";
      }
    }

    if (!productName) {
      return "Quote intake started. Please provide the coverage option name so a quote can be prepared.";
    }

    if (!stateCode) {
      return (
        "Quote intake started for " +
        productName +
        ". Please provide the state where coverage is needed so a broker can continue the quote review."
      );
    }

    if (!vehicleUse) {
      return (
        "Quote intake started for " +
        productName +
        " in " +
        stateCode +
        ". Please describe the primary vehicle use as personal, commute, business, or rideshare so a broker can continue the quote review."
      );
    }

    if (!priorInsuranceStatus) {
      return (
        "Quote intake started for " +
        productName +
        " in " +
        stateCode +
        ". Please describe prior insurance status as insured, uninsured, or lapsed so a broker can continue the quote review."
      );
    }

    const vehicleUseSuffix =
      vehicleUse === "personal"
        ? " Vehicle use: personal."
        : vehicleUse === "commute"
          ? " Vehicle use: commute."
          : vehicleUse === "business"
            ? " Vehicle use: business."
            : vehicleUse === "rideshare"
              ? " Vehicle use: rideshare."
              : "";

    const priorInsuranceStatusSuffix =
      priorInsuranceStatus === "insured"
        ? " Prior insurance status: insured."
        : priorInsuranceStatus === "uninsured"
          ? " Prior insurance status: uninsured."
          : priorInsuranceStatus === "lapsed"
            ? " Prior insurance status: lapsed."
            : "";

    const contactSuffix =
      contactPreference === "call"
        ? " Preferred contact: call."
        : contactPreference === "text"
          ? " Preferred contact: text."
          : contactPreference === "email"
            ? " Preferred contact: email."
            : "";

    return (
      "Quote intake started for " +
      productName +
      " in " +
      stateCode +
      ". A broker can now continue with eligibility, underwriting review, and premium estimation." +
      vehicleUseSuffix +
      priorInsuranceStatusSuffix +
      contactSuffix
    );
  }

  if (resolvedIntentId === "consult-price") {
    const productName = sanitizeProductNameCandidate(findEntityValue(session, "productName") ?? "");
    if (!productName) {
      return undefined;
    }

    const product = findProductByName(productName);
    if (!product) {
      return "I could not find a product with the provided product name. Please verify the product name and try again.";
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
      return "I could not find a product with the provided product name. Please verify the product name and try again.";
    }

    return (
      "Product: " +
      product.name +
      " | Availability: " +
      product.availability +
      " | Eligibility: " +
      String(product.eligibilityStatus ?? product.availability) +
      " | Broker Review Required: " +
      String(Boolean(product.brokerReviewRequired)) +
      " | Underwriting Review Required: " +
      String(Boolean(product.underwritingReviewRequired)) +
      " | Additional Documents Required: " +
      String(Boolean(product.additionalDocumentsRequired)) +
      (product.availabilityNotes ? " | Notes: " + product.availabilityNotes : "")
    );
  }

  if (resolvedIntentId === "consult-product") {
    const productName = sanitizeProductNameCandidate(findEntityValue(session, "productName") ?? "");
    if (!productName) {
      return undefined;
    }

    const product = findProductByName(productName);
    if (!product) {
      return "I could not find a product with the provided product name. Please verify the product name and try again.";
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

  if (resolvedIntentId === "consult-policy") {
    const policyTopic = sanitizePolicyTopicCandidate(findEntityValue(session, "policyTopic") ?? "");
    if (!policyTopic) {
      return undefined;
    }

    const policy = findPolicyByTopic(policyTopic);
    if (!policy) {
      return "I could not find policy information for the provided policy topic. Please verify the policy topic and try again.";
    }

    const policyAspect = sanitizePolicyAspectCandidate(
      findEntityValue(session, "policyAspect") ?? "summary"
    );

    if (policyAspect === "return-window" && typeof policy.returnWindowDays === "number") {
      return (
        "Policy: " +
        policy.title +
        " | Return Window: " +
        String(policy.returnWindowDays) +
        " calendar days from delivery."
      );
    }

    if (
      policyAspect === "document-delivery-status" &&
      typeof policy.documentDeliveryStatusSupported === "boolean"
    ) {
      return (
        "Policy: " +
        policy.title +
        " | Document Delivery Status: " +
        (policy.documentDeliveryStatusSupported
          ? "Document delivery status checks are supported."
          : "Document delivery status checks are not supported.") +
        (policy.documentDeliveryStatusNotes ? " " + policy.documentDeliveryStatusNotes : "")
      );
    }

    if (
      policyAspect === "refund-timing" &&
      typeof policy.refundProcessingBusinessDaysMin === "number" &&
      typeof policy.refundProcessingBusinessDaysMax === "number"
    ) {
      return (
        "Policy: " +
        policy.title +
        " | Refund Timing: " +
        String(policy.refundProcessingBusinessDaysMin) +
        " to " +
        String(policy.refundProcessingBusinessDaysMax) +
        " business days after the return is processed."
      );
    }

    if (
      policyAspect === "premium-adjustment-guidance" &&
      typeof policy.premiumAdjustmentRequestSupported === "boolean"
    ) {
      return (
        "Policy: " +
        policy.title +
        " | Premium Adjustment Guidance: " +
        (policy.premiumAdjustmentRequestSupported
          ? "Premium adjustment requests are supported."
          : "Premium adjustment requests are not supported.") +
        (policy.premiumAdjustmentRequestNotes ? " " + policy.premiumAdjustmentRequestNotes : "")
      );
    }

    if (
      policyAspect === "endorsement-guidance" &&
      typeof policy.endorsementRequestSupported === "boolean"
    ) {
      return (
        "Policy: " +
        policy.title +
        " | Endorsement Guidance: " +
        (policy.endorsementRequestSupported
          ? "Policy change and endorsement requests are supported."
          : "Policy change and endorsement requests are not supported.") +
        (policy.endorsementRequestNotes ? " " + policy.endorsementRequestNotes : "")
      );
    }

    if (
      policyAspect === "cancellation-eligibility" &&
      typeof policy.cancellationBeforeShipmentOnly === "boolean"
    ) {
      return (
        "Policy: " +
        policy.title +
        " | Cancellation Eligibility: Orders may be cancelled before shipment only. Orders that have already shipped cannot be cancelled and must follow the return policy."
      );
    }

    return "Policy: " + policy.title + " | Summary: " + policy.summary;
  }

  if (resolvedIntentId === "consult-payment-status") {
    const paymentId = sanitizePaymentIdCandidate(findEntityValue(session, "paymentId") ?? "");
    if (!paymentId) {
      return undefined;
    }

    const record = findPaymentAuditRecordByPaymentId(paymentId);
    if (!record) {
      return "I could not find a payment record with the provided payment ID. Please verify the payment ID and try again.";
    }

    if (record.discrepancyType === "none") {
      return (
        "Payment " +
        record.paymentId +
        " is currently " +
        record.paymentStatus +
        ". Audit status: " +
        record.auditStatus +
        ". No discrepancy has been detected at this time."
      );
    }

    return (
      "Payment " +
      record.paymentId +
      " is currently " +
      record.paymentStatus +
      ". Audit status: " +
      record.auditStatus +
      ". Discrepancy type: " +
      record.discrepancyType +
      "."
    );
  }

  if (resolvedIntentId === "consult-payment-history") {
    const policyId = sanitizePolicyIdCandidate(findEntityValue(session, "policyId") ?? "");
    const customerId = sanitizeCustomerIdCandidate(findEntityValue(session, "customerId") ?? "");

    const records = policyId
      ? listPaymentAuditRecordsByPolicyId(policyId)
      : customerId
        ? listPaymentAuditRecordsByCustomerId(customerId)
        : [];

    if (records.length === 0) {
      return "I could not find payment history for the provided account scope. Please verify the available identifiers and try again.";
    }

    const sorted = records
      .slice()
      .sort((a, b) => a.updatedAtIso.localeCompare(b.updatedAtIso));

    const latest = sorted[sorted.length - 1];
    if (!latest) {
      return "I could not find payment history for the provided account scope. Please verify the available identifiers and try again.";
    }

    const paymentStatusCounts = new Map<string, number>();
    for (const record of sorted) {
      paymentStatusCounts.set(
        record.paymentStatus,
        (paymentStatusCounts.get(record.paymentStatus) ?? 0) + 1
      );
    }

    const paymentStatusSummary = Array.from(paymentStatusCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([status, count]) => status + ":" + String(count))
      .join(",");

    return (
      "Payment history scope: " +
      (policyId ? "Policy " + policyId : "Customer " + customerId) +
      " | Records: " +
      String(sorted.length) +
      " | Latest payment: " +
      latest.paymentId +
      " | Latest audit status: " +
      latest.auditStatus +
      " | Payment statuses: " +
      paymentStatusSummary +
      "."
    );
  }

  if (resolvedIntentId === "explain-payment-discrepancy") {
    const paymentId = sanitizePaymentIdCandidate(findEntityValue(session, "paymentId") ?? "");
    const discrepancyType = sanitizeDiscrepancyTypeCandidate(
      findEntityValue(session, "discrepancyType") ?? "billing discrepancy"
    );

    let record = paymentId ? findPaymentAuditRecordByPaymentId(paymentId) : undefined;

    if (!record && discrepancyType) {
      const candidates = listPaymentAuditRecordsByDiscrepancyType(discrepancyType)
        .slice()
        .sort((a, b) => a.updatedAtIso.localeCompare(b.updatedAtIso));
      record = candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
    }

    if (record) {
      return (
        "Payment discrepancy review: " +
        record.paymentId +
        " | Discrepancy Type: " +
        record.discrepancyType +
        " | Audit Result: " +
        record.auditStatus +
        " | Billing state: " +
        record.billingState +
        "."
      );
    }

    return (
      "Payment discrepancy review: " +
      (paymentId ? paymentId : "unscoped payment") +
      " | Discrepancy Type: " +
      discrepancyType +
      " | Audit Result: manual review recommended."
    );
  }

  if (resolvedIntentId === "consult-policy-status") {
    const policyId = sanitizePolicyIdCandidate(findEntityValue(session, "policyId") ?? "");
    if (!policyId) {
      return undefined;
    }

    const record = findLatestPaymentAuditRecordByPolicyId(policyId);
    if (!record) {
      return "I could not find policy billing status for the provided policy ID. Please verify the policy ID and try again.";
    }

    return (
      "Policy " +
      record.policyId +
      " is currently active. Billing state: " +
      record.billingState +
      ". Latest audit status: " +
      record.auditStatus +
      "."
    );
  }

  if (resolvedIntentId === "consult-policy-servicing") {
    const billingTopic = sanitizeBillingTopicCandidate(findEntityValue(session, "billingTopic") ?? "");
    if (!billingTopic) {
      return undefined;
    }

    const policyId = sanitizePolicyIdCandidate(findEntityValue(session, "policyId") ?? "");

    if (policyId) {
      const records = listPaymentAuditRecordsByPolicyId(policyId)
        .slice()
        .sort((a, b) => a.updatedAtIso.localeCompare(b.updatedAtIso));

      const exact = records.filter((item) => item.servicingTopic === billingTopic);
      const matched = exact.length > 0 ? exact[exact.length - 1] : undefined;

      if (matched) {
        return (
          "Policy servicing topic: " +
          matched.servicingTopic +
          " | Guidance: the servicing request can proceed through the " +
          matched.servicingDisposition +
          "."
        );
      }

      if (records.length === 0) {
        return "I could not find policy servicing information for the provided policy ID. Please verify the policy ID and try again.";
      }
    }

    return (
      "Policy servicing topic: " +
      billingTopic +
      " | Guidance: the servicing request can proceed through the billing review workflow."
    );
  }

  return undefined;
}

export function runCustomerServiceAgent(params: {
  session: SessionState;
  userMessageText: string;
}): CustomerServiceAgentResult {
  const businessContextId =
    typeof params.session.businessContextId === "string" &&
    params.session.businessContextId.trim().length > 0
      ? params.session.businessContextId
      : "customer-service-core-v2";

  const pack = loadCustomerServicePackByContextId(businessContextId);
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
    } else if (entity.entityId === "policyTopic") {
      sanitizedValue = sanitizePolicyTopicCandidate(entity.value);
    } else if (entity.entityId === "policyAspect") {
      sanitizedValue = sanitizePolicyAspectCandidate(entity.value);
    } else if (entity.entityId === "paymentId") {
      sanitizedValue = sanitizePaymentIdCandidate(entity.value);
    } else if (entity.entityId === "policyId") {
      sanitizedValue = sanitizePolicyIdCandidate(entity.value);
    } else if (entity.entityId === "customerId") {
      sanitizedValue = sanitizeCustomerIdCandidate(entity.value);
    } else if (entity.entityId === "billingTopic") {
      sanitizedValue = sanitizeBillingTopicCandidate(entity.value);
    } else if (entity.entityId === "discrepancyType") {
      sanitizedValue = sanitizeDiscrepancyTypeCandidate(entity.value);
    } else if (entity.entityId === "vehicleUse") {
      const normalizedVehicleUse = normalizeLooseEntityText(entity.value)?.toLowerCase();
      sanitizedValue =
        normalizedVehicleUse === "personal" ||
        normalizedVehicleUse === "commute" ||
        normalizedVehicleUse === "business" ||
        normalizedVehicleUse === "rideshare"
          ? normalizedVehicleUse
          : undefined;
    } else if (entity.entityId === "priorInsuranceStatus") {
      const normalizedPriorInsuranceStatus = normalizeLooseEntityText(entity.value)?.toLowerCase();
      sanitizedValue =
        normalizedPriorInsuranceStatus === "insured" ||
        normalizedPriorInsuranceStatus === "uninsured" ||
        normalizedPriorInsuranceStatus === "lapsed"
          ? normalizedPriorInsuranceStatus
          : undefined;
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
