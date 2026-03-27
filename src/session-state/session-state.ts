export type ConversationLifecycleStatus =
  | "active"
  | "waiting-user"
  | "handoff-requested"
  | "closed";

export interface ConversationTurnRecord {
  turnId: string;
  speaker: "user" | "agent" | "system";
  messageText: string;
  createdAtIso: string;
}

export interface ConversationEntityValue {
  entityId: string;
  value: string;
  confidence: "confirmed" | "derived";
}

export interface SessionState {
  sessionId: string;
  businessContextId: string;
  conversationStatus: ConversationLifecycleStatus;
  currentIntentId?: string;
  currentWorkflowId?: string;
  currentStage?: string;
  collectedEntities: ConversationEntityValue[];
  missingEntityIds: string[];
  handoffRequested: boolean;
  handoffReasonCode?: string;
  handoffQueue?: string;
  lastUserMessageHash?: string;
  lastCanonicalResponseId?: string;
  turns: ConversationTurnRecord[];
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

export function createInitialSessionState(params: {
  sessionId: string;
  businessContextId: string;
}): SessionState {
  return {
    sessionId: normalizeText(params.sessionId),
    businessContextId: normalizeText(params.businessContextId),
    conversationStatus: "active",
    collectedEntities: [],
    missingEntityIds: [],
    handoffRequested: false,
    turns: [],
  };
}

export function appendSessionTurn(
  state: SessionState,
  turn: ConversationTurnRecord
): SessionState {
  return {
    ...state,
    turns: [
      ...state.turns,
      {
        turnId: normalizeText(turn.turnId),
        speaker: turn.speaker,
        messageText: normalizeText(turn.messageText),
        createdAtIso: normalizeText(turn.createdAtIso),
      },
    ],
  };
}

export function upsertSessionEntity(
  state: SessionState,
  entity: ConversationEntityValue
): SessionState {
  const normalized = {
    entityId: normalizeText(entity.entityId),
    value: normalizeText(entity.value),
    confidence: entity.confidence,
  };

  const filtered = state.collectedEntities.filter(
    (item) => item.entityId !== normalized.entityId
  );

  return {
    ...state,
    collectedEntities: [...filtered, normalized],
    missingEntityIds: state.missingEntityIds.filter(
      (item) => item !== normalized.entityId
    ),
  };
}

export function setSessionIntent(
  state: SessionState,
  params: {
    intentId: string;
    workflowId: string;
    stage: string;
    missingEntityIds: string[];
  }
): SessionState {
  return {
    ...state,
    currentIntentId: normalizeText(params.intentId),
    currentWorkflowId: normalizeText(params.workflowId),
    currentStage: normalizeText(params.stage),
    missingEntityIds: params.missingEntityIds.map((item) => normalizeText(item)),
    conversationStatus:
      params.missingEntityIds.length > 0 ? "waiting-user" : "active",
    handoffReasonCode: undefined,
    handoffQueue: undefined,
  };
}

export function requestHumanHandoff(
  state: SessionState,
  params?: {
    reasonCode?: string;
    queue?: string;
  }
): SessionState {
  return {
    ...state,
    handoffRequested: true,
    conversationStatus: "handoff-requested",
    handoffReasonCode:
      typeof params?.reasonCode === "string" && params.reasonCode.trim().length > 0
        ? normalizeText(params.reasonCode)
        : undefined,
    handoffQueue:
      typeof params?.queue === "string" && params.queue.trim().length > 0
        ? normalizeText(params.queue)
        : undefined,
  };
}

export function closeSessionState(state: SessionState): SessionState {
  return {
    ...state,
    conversationStatus: "closed",
  };
}