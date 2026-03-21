import type {
  BusinessContextPack,
  BusinessIntentDefinition,
} from "../business-context/context-pack";

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

export function listBusinessIntentIds(pack: BusinessContextPack): string[] {
  return pack.supportedIntents.map((intent) => normalizeText(intent.intentId));
}

export function getBusinessIntentById(
  pack: BusinessContextPack,
  intentId: string
): BusinessIntentDefinition | undefined {
  const normalizedIntentId = normalizeText(intentId);

  return pack.supportedIntents.find(
    (intent) => normalizeText(intent.intentId) === normalizedIntentId
  );
}

export function requireBusinessIntentById(
  pack: BusinessContextPack,
  intentId: string
): BusinessIntentDefinition {
  const intent = getBusinessIntentById(pack, intentId);

  if (!intent) {
    throw new Error(
      'BUSINESS_INTENT_NOT_FOUND: intentId="' + normalizeText(intentId) + '"'
    );
  }

  return intent;
}

export function listRequiredEntityIdsForIntent(
  pack: BusinessContextPack,
  intentId: string
): string[] {
  const intent = requireBusinessIntentById(pack, intentId);
  return intent.requiredEntities.map((entityId) => normalizeText(entityId));
}

export function listOptionalEntityIdsForIntent(
  pack: BusinessContextPack,
  intentId: string
): string[] {
  const intent = requireBusinessIntentById(pack, intentId);
  return intent.optionalEntities.map((entityId) => normalizeText(entityId));
}