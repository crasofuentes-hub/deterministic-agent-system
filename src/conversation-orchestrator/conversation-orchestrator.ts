import type { BusinessContextPack, BusinessHandoffRule } from "../business-context/context-pack";
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

function resolveMissingStage(intentId: string): string {
  if (
    intentId === "consult-product" ||
    intentId === "consult-price" ||
    intentId === "consult-availability"
  ) {
    return "collect-product-name";
  }

  if (intentId === "consult-order-status") {
    return "collect-order-id";
  }

  return "collect-missing-data";
}

function resolveResolvedStage(intentId: string): string {
  if (intentId === "consult-product") {
    return "resolve-product";
  }

  if (intentId === "consult-price") {
    return "resolve-price";
  }

  if (intentId === "consult-availability") {
    return "resolve-availability";
  }

  if (intentId === "consult-order-status") {
    return "resolve-order-status";
  }

  return "done";
}

function resolveMissingResponseId(intentId: string): string {
  if (intentId === "consult-product") {
    return "consult-product-missing-product-name";
  }

  if (intentId === "consult-price") {
    return "consult-price-missing-product-name";
  }

  if (intentId === "consult-availability") {
    return "consult-availability-missing-product-name";
  }

  if (intentId === "consult-order-status") {
    return "consult-order-status-missing-order-id";
  }

  return "missing-data";
}

function resolveResolvedResponseId(intentId: string): string {
  if (intentId === "consult-product") {
    return "consult-product-resolved";
  }

  if (intentId === "consult-price") {
    return "consult-price-resolved";
  }

  if (intentId === "consult-availability") {
    return "consult-availability-resolved";
  }

  if (intentId === "consult-order-status") {
    return "consult-order-status-resolved";
  }

  return "resolved";
}

function resolveHandoffRule(
  pack: BusinessContextPack,
  params: {
    intentId: string;
    status: string;
  }
): BusinessHandoffRule | undefined {
  return pack.handoffRules.find((rule) => {
    const intentMatches =
      !rule.whenIntentIds || rule.whenIntentIds.includes(params.intentId);

    const statusMatches =
      !rule.whenStatuses || rule.whenStatuses.includes(params.status);

    return intentMatches && statusMatches && rule.requiresHuman;
  });
}

export function orchestrateConversationTurn(params: {
  pack: BusinessContextPack;
  session: SessionState;
  intentId: string;
}): ConversationOrchestratorResult {
  const { pack, session, intentId } = params;
  const intent = requireBusinessIntentById(pack, intentId);

  if (intent.intentId === "request-human-handoff") {
    const handoffRule = resolveHandoffRule(pack, {
      intentId: intent.intentId,
      status: "handoff",
    });

    const nextSession = requestHumanHandoff(
      setSessionIntent(session, {
        intentId: intent.intentId,
        workflowId: intent.workflowId,
        stage: "handoff-requested",
        missingEntityIds: [],
      }),
      {
        reasonCode: handoffRule?.ruleId,
        queue: handoffRule?.queue,
      }
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
    const stage = resolveMissingStage(intent.intentId);
    const nextSession = setSessionIntent(session, {
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage,
      missingEntityIds: entityEvaluation.missingEntityIds,
    });

    return {
      session: nextSession,
      responseText: renderCanonicalResponseText(pack, {
        intentId: intent.intentId,
        stage,
        status: "missing-entity",
      }),
      responseId: resolveMissingResponseId(intent.intentId),
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage,
      status: "missing-entity",
    };
  }

  const stage = resolveResolvedStage(intent.intentId);
  const nextSession = setSessionIntent(session, {
    intentId: intent.intentId,
    workflowId: intent.workflowId,
    stage,
    missingEntityIds: [],
  });

  return {
    session: nextSession,
    responseText: renderCanonicalResponseText(pack, {
      intentId: intent.intentId,
      stage,
      status: "resolved",
    }),
    responseId: resolveResolvedResponseId(intent.intentId),
    intentId: intent.intentId,
    workflowId: intent.workflowId,
    stage,
    status: "resolved",
  };
}