import type { BusinessContextPack } from "../business-context/context-pack";
import type { SessionState } from "../session-state/session-state";
import { requireBusinessIntentById } from "../intent-catalog/intent-catalog";

export interface EntityCollectionEvaluation {
  intentId: string;
  presentEntityIds: string[];
  missingEntityIds: string[];
  isComplete: boolean;
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

export function listCollectedEntityIds(state: SessionState): string[] {
  return state.collectedEntities.map((entity) => normalizeText(entity.entityId));
}

export function evaluateEntityCollection(
  pack: BusinessContextPack,
  state: SessionState,
  intentId: string
): EntityCollectionEvaluation {
  const intent = requireBusinessIntentById(pack, intentId);
  const present = new Set(listCollectedEntityIds(state));
  const required = intent.requiredEntities.map((entityId) => normalizeText(entityId));

  const missing = required.filter((entityId) => !present.has(entityId));

  return {
    intentId: normalizeText(intent.intentId),
    presentEntityIds: required.filter((entityId) => present.has(entityId)),
    missingEntityIds: missing,
    isComplete: missing.length === 0,
  };
}

export function requireSingleMissingEntityPromptTarget(
  evaluation: EntityCollectionEvaluation
): string {
  if (evaluation.missingEntityIds.length !== 1) {
    throw new Error(
      "ENTITY_PROMPT_TARGET_NOT_SINGLE: missing=" +
        evaluation.missingEntityIds.length
    );
  }

  return evaluation.missingEntityIds[0] ?? "";
}