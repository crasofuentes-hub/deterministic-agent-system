import type { BusinessContextPack } from "../business-context/context-pack";
import { renderCanonicalResponseText } from "../canonical-response/canonical-response-engine";
import { evaluateEntityCollection } from "../entity-rules/entity-collection-rules";
import { requireBusinessIntentById } from "../intent-catalog/intent-catalog";
import type { SessionState } from "../session-state/session-state";
import {
  closeSessionState,
  requestHumanHandoff,
  setSessionIntent,
} from "../session-state/session-state";

export interface ConversationOrchestratorResult {
  session: SessionState;
  responseText: string;
  responseId: string;
  intentId: string;
  workflowId: string;
  stage: string;
  status: string;
}

export function orchestrateConversationTurn(params: {
  pack: BusinessContextPack;
  session: SessionState;
  intentId: string;
}): ConversationOrchestratorResult {
  const { pack, session, intentId } = params;
  const intent = requireBusinessIntentById(pack, intentId);

  if (intent.intentId === "request-human-handoff") {
    const nextSession = requestHumanHandoff(
      setSessionIntent(session, {
        intentId: intent.intentId,
        workflowId: intent.workflowId,
        stage: "handoff-requested",
        missingEntityIds: [],
      })
    );

    return {
      session: nextSession,
      responseText: renderCanonicalResponseText(pack, {
        intentId: intent.intentId,
        stage: "handoff-requested",
        status: "handoff",
      }),
      responseId: "handoff-requested",
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage: "handoff-requested",
      status: "handoff",
    };
  }

  if (intent.intentId === "close-conversation") {
    const nextSession = closeSessionState(
      setSessionIntent(session, {
        intentId: intent.intentId,
        workflowId: intent.workflowId,
        stage: "done",
        missingEntityIds: [],
      })
    );

    return {
      session: nextSession,
      responseText: renderCanonicalResponseText(pack, {
        intentId: intent.intentId,
        stage: "done",
        status: "closed",
      }),
      responseId: "conversation-closed",
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage: "done",
      status: "closed",
    };
  }

  const entityEvaluation = evaluateEntityCollection(pack, session, intent.intentId);

  if (!entityEvaluation.isComplete) {
    const nextSession = setSessionIntent(session, {
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage: "collect-case-id",
      missingEntityIds: entityEvaluation.missingEntityIds,
    });

    return {
      session: nextSession,
      responseText: renderCanonicalResponseText(pack, {
        intentId: intent.intentId,
        stage: "collect-case-id",
        status: "missing-entity",
      }),
      responseId: "consult-status-missing-case-id",
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage: "collect-case-id",
      status: "missing-entity",
    };
  }

  const nextSession = setSessionIntent(session, {
    intentId: intent.intentId,
    workflowId: intent.workflowId,
    stage: "resolve-status",
    missingEntityIds: [],
  });

  return {
    session: nextSession,
    responseText: renderCanonicalResponseText(pack, {
      intentId: intent.intentId,
      stage: "resolve-status",
      status: "resolved",
    }),
    responseId: "consult-status-resolved",
    intentId: intent.intentId,
    workflowId: intent.workflowId,
    stage: "resolve-status",
    status: "resolved",
  };
}