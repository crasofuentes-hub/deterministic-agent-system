import type {
  BusinessCanonicalResponseDefinition,
  BusinessContextPack,
} from "../business-context/context-pack";

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

export function findCanonicalResponse(
  pack: BusinessContextPack,
  params: {
    intentId: string;
    stage: string;
    status: string;
  }
): BusinessCanonicalResponseDefinition | undefined {
  const intentId = normalizeText(params.intentId);
  const stage = normalizeText(params.stage);
  const status = normalizeText(params.status);

  return pack.canonicalResponses.find(
    (response) =>
      normalizeText(response.intentId) === intentId &&
      normalizeText(response.stage) === stage &&
      normalizeText(response.status) === status
  );
}

export function requireCanonicalResponse(
  pack: BusinessContextPack,
  params: {
    intentId: string;
    stage: string;
    status: string;
  }
): BusinessCanonicalResponseDefinition {
  const response = findCanonicalResponse(pack, params);

  if (!response) {
    throw new Error(
      'CANONICAL_RESPONSE_NOT_FOUND: intentId="' +
        normalizeText(params.intentId) +
        '" stage="' +
        normalizeText(params.stage) +
        '" status="' +
        normalizeText(params.status) +
        '"'
    );
  }

  return response;
}

export function renderCanonicalResponseText(
  pack: BusinessContextPack,
  params: {
    intentId: string;
    stage: string;
    status: string;
  }
): string {
  const response = requireCanonicalResponse(pack, params);
  return normalizeText(response.messageTemplate);
}