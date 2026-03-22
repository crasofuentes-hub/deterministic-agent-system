import fs from "node:fs";
import path from "node:path";
import type { BusinessContextPack } from "../business-context/context-pack";
import { orchestrateConversationTurn } from "../conversation-orchestrator/conversation-orchestrator";
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

  return {
    session: result.session,
    resolvedIntentId: result.intentId,
    responseText: result.responseText,
    responseId: result.responseId,
    stage: result.stage,
    status: result.status,
  };
}