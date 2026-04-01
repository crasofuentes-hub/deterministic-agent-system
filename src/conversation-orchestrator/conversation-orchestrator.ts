import type { BusinessContextPack, BusinessHandoffRule } from "../business-context/context-pack";
import { findCanonicalResponse, renderCanonicalResponseText } from "../canonical-response/canonical-response-engine";
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

function getWorkflowStages(
  pack: BusinessContextPack,
  workflowId: string
): {
  initialStage: string;
  terminalStages: string[];
  middleStages: string[];
} {
  const workflow = pack.workflowRules.find((item) => item.workflowId === workflowId);

  if (!workflow) {
    throw new Error('WORKFLOW_NOT_FOUND: workflowId="' + workflowId + '"');
  }

  const terminal = new Set(workflow.terminalStages);
  const middleStages = workflow.stages.filter(
    (stage) => stage !== workflow.initialStage && !terminal.has(stage)
  );

  return {
    initialStage: workflow.initialStage,
    terminalStages: workflow.terminalStages,
    middleStages,
  };
}

function resolveMissingStage(pack: BusinessContextPack, workflowId: string): string {
  const workflowStages = getWorkflowStages(pack, workflowId);
  return workflowStages.middleStages[0] ?? "collect-missing-data";
}

function resolveResolvedStage(pack: BusinessContextPack, workflowId: string): string {
  const workflowStages = getWorkflowStages(pack, workflowId);

  if (workflowStages.middleStages.length === 0) {
    return workflowStages.terminalStages[0] ?? "done";
  }

  const lastIndex = workflowStages.middleStages.length - 1;
  const resolvedStage = workflowStages.middleStages[lastIndex];

  if (typeof resolvedStage !== "string" || resolvedStage.length === 0) {
    return workflowStages.terminalStages[0] ?? "done";
  }

  return resolvedStage;
}

function resolveResponseId(
  pack: BusinessContextPack,
  params: {
    intentId: string;
    stage: string;
    status: string;
  }
): string {
  const response = findCanonicalResponse(pack, params);

  if (!response) {
    throw new Error(
      'RESPONSE_ID_NOT_FOUND: intentId="' +
        params.intentId +
        '" stage="' +
        params.stage +
        '" status="' +
        params.status +
        '"'
    );
  }

  return response.responseId;
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
      responseId: resolveResponseId(pack, {
        intentId: intent.intentId,
        stage: "handoff-requested",
        status: "handoff",
      }),
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
      responseId: resolveResponseId(pack, {
        intentId: intent.intentId,
        stage: "done",
        status: "closed",
      }),
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage: "done",
      status: "closed",
    };
  }

  const entityEvaluation = evaluateEntityCollection(pack, session, intent.intentId);

  if (!entityEvaluation.isComplete) {
    const stage = resolveMissingStage(pack, intent.workflowId);
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
      responseId: resolveResponseId(pack, {
        intentId: intent.intentId,
        stage,
        status: "missing-entity",
      }),
      intentId: intent.intentId,
      workflowId: intent.workflowId,
      stage,
      status: "missing-entity",
    };
  }

  const stage = resolveResolvedStage(pack, intent.workflowId);
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
    responseId: resolveResponseId(pack, {
      intentId: intent.intentId,
      stage,
      status: "resolved",
    }),
    intentId: intent.intentId,
    workflowId: intent.workflowId,
    stage,
    status: "resolved",
  };
}