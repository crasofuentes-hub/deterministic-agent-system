import { createInitialSessionState, type SessionState } from "../../session-state/session-state";

export interface WhatsAppConversationEvidence {
  customerId: string;
  lastInboundMessageId: string;
  lastResponseId: string;
  lastResolvedIntentId: string;
  lastStage: string;
  lastStatus: string;
  lastOutboundText: string;
  humanInterventionRequired: boolean;
  handoffReasonCode?: string;
  handoffQueue?: string;
  updatedAtIso: string;
}

export interface WhatsAppHandoffRecord {
  handoffId: string;
  customerId: string;
  createdAtIso: string;
  updatedAtIso: string;
  handoffReasonCode?: string;
  handoffQueue?: string;
  status: "open" | "closed";
  lastInboundMessageId: string;
  lastResponseId: string;
  lastResolvedIntentId: string;
  lastStage: string;
  lastStatus: string;
  lastOutboundText: string;
}
export interface WhatsAppConversationEvent {
  eventId: string;
  customerId: string;
  occurredAtIso: string;
  kind: "inbound" | "outbound" | "handoff";
  channelMessageId?: string;
  responseId?: string;
  resolvedIntentId?: string;
  stage?: string;
  status?: string;
  text?: string;
  handoffId?: string;
  handoffReasonCode?: string;
  handoffQueue?: string;
}

export interface WhatsAppStore {
  loadSession(customerId: string): SessionState;
  saveSession(customerId: string, session: SessionState): void;
  hasProcessedMessage(channelMessageId: string): boolean;
  markMessageProcessed(channelMessageId: string): void;
  loadEvidence(customerId: string): WhatsAppConversationEvidence | undefined;
  saveEvidence(evidence: WhatsAppConversationEvidence): void;
  listHandoffs(): WhatsAppHandoffRecord[];
  saveHandoff(record: WhatsAppHandoffRecord): void;
  listConversationEvents(customerId: string): WhatsAppConversationEvent[];
  saveConversationEvent(event: WhatsAppConversationEvent): void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeConversationEvent(event: WhatsAppConversationEvent): WhatsAppConversationEvent {
  if (!isNonEmptyString(event.eventId)) {
    throw new Error("eventId must be a non-empty string");
  }

  if (!isNonEmptyString(event.customerId)) {
    throw new Error("customerId must be a non-empty string");
  }

  if (!isNonEmptyString(event.occurredAtIso)) {
    throw new Error("occurredAtIso must be a non-empty string");
  }

  if (event.kind !== "inbound" && event.kind !== "outbound" && event.kind !== "handoff") {
    throw new Error("event kind must be one of: inbound, outbound, handoff");
  }

  return {
    ...event,
    eventId: event.eventId.trim(),
    customerId: event.customerId.trim(),
    occurredAtIso: event.occurredAtIso.trim(),
    channelMessageId: event.channelMessageId?.trim() || undefined,
    responseId: event.responseId?.trim() || undefined,
    resolvedIntentId: event.resolvedIntentId?.trim() || undefined,
    stage: event.stage?.trim() || undefined,
    status: event.status?.trim() || undefined,
    text: event.text?.trim() || undefined,
    handoffId: event.handoffId?.trim() || undefined,
    handoffReasonCode: event.handoffReasonCode?.trim() || undefined,
    handoffQueue: event.handoffQueue?.trim() || undefined,
  };
}
function normalizeHandoffRecord(record: WhatsAppHandoffRecord): WhatsAppHandoffRecord {
  if (!isNonEmptyString(record.handoffId)) {
    throw new Error("handoffId must be a non-empty string");
  }
  if (!isNonEmptyString(record.customerId)) {
    throw new Error("customerId must be a non-empty string");
  }
  if (!isNonEmptyString(record.createdAtIso)) {
    throw new Error("createdAtIso must be a non-empty string");
  }
  if (!isNonEmptyString(record.updatedAtIso)) {
    throw new Error("updatedAtIso must be a non-empty string");
  }
  if (record.status !== "open" && record.status !== "closed") {
    throw new Error("handoff status must be one of: open, closed");
  }
  if (!isNonEmptyString(record.lastInboundMessageId)) {
    throw new Error("lastInboundMessageId must be a non-empty string");
  }
  if (!isNonEmptyString(record.lastResponseId)) {
    throw new Error("lastResponseId must be a non-empty string");
  }
  if (!isNonEmptyString(record.lastResolvedIntentId)) {
    throw new Error("lastResolvedIntentId must be a non-empty string");
  }
  if (!isNonEmptyString(record.lastStage)) {
    throw new Error("lastStage must be a non-empty string");
  }
  if (!isNonEmptyString(record.lastStatus)) {
    throw new Error("lastStatus must be a non-empty string");
  }
  if (!isNonEmptyString(record.lastOutboundText)) {
    throw new Error("lastOutboundText must be a non-empty string");
  }
  return {
    ...record,
    handoffId: record.handoffId.trim(),
    customerId: record.customerId.trim(),
    createdAtIso: record.createdAtIso.trim(),
    updatedAtIso: record.updatedAtIso.trim(),
    handoffReasonCode: record.handoffReasonCode?.trim() || undefined,
    handoffQueue: record.handoffQueue?.trim() || undefined,
    lastInboundMessageId: record.lastInboundMessageId.trim(),
    lastResponseId: record.lastResponseId.trim(),
    lastResolvedIntentId: record.lastResolvedIntentId.trim(),
    lastStage: record.lastStage.trim(),
    lastStatus: record.lastStatus.trim(),
    lastOutboundText: record.lastOutboundText.trim(),
  };
}

export interface InMemoryWhatsAppStoreOptions {
  businessContextId: string;
  sessionIdPrefix?: string;
}

export function createInMemoryWhatsAppStore(options: InMemoryWhatsAppStoreOptions): WhatsAppStore {
  if (!isNonEmptyString(options.businessContextId)) {
    throw new Error("businessContextId must be a non-empty string");
  }
  const businessContextId = options.businessContextId.trim();
  const sessionIdPrefix = isNonEmptyString(options.sessionIdPrefix) ? options.sessionIdPrefix.trim() : "whatsapp-session";
  const sessions = new Map<string, SessionState>();
  const processedMessageIds = new Set<string>();
  const evidenceByCustomerId = new Map<string, WhatsAppConversationEvidence>();
  const handoffsById = new Map<string, WhatsAppHandoffRecord>();
  const eventsByCustomerId = new Map<string, WhatsAppConversationEvent[]>();

  return {
    loadSession(customerId: string): SessionState {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be non-empty string");
      }
      const key = customerId.trim();
      const existing = sessions.get(key);
      if (existing) {
        return existing;
      }
      return createInitialSessionState({
        sessionId: sessionIdPrefix + ":" + key,
        businessContextId,
      });
    },
    saveSession(customerId: string, session: SessionState): void {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be non-empty string");
      }
      sessions.set(customerId.trim(), session);
    },
    hasProcessedMessage(channelMessageId: string): boolean {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be non-empty string");
      }
      return processedMessageIds.has(channelMessageId.trim());
    },
    markMessageProcessed(channelMessageId: string): void {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be non-empty string");
      }
      processedMessageIds.add(channelMessageId.trim());
    },
    loadEvidence(customerId: string): WhatsAppConversationEvidence | undefined {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be non-empty string");
      }
      return evidenceByCustomerId.get(customerId.trim());
    },
    saveEvidence(evidence: WhatsAppConversationEvidence): void {
      if (!isNonEmptyString(evidence.customerId)) {
        throw new Error("customerId must be non-empty string");
      }
      evidenceByCustomerId.set(evidence.customerId.trim(), {
        ...evidence,
        customerId: evidence.customerId.trim(),
        lastInboundMessageId: evidence.lastInboundMessageId.trim(),
        lastResponseId: evidence.lastResponseId.trim(),
        lastResolvedIntentId: evidence.lastResolvedIntentId.trim(),
        lastStage: evidence.lastStage.trim(),
        lastStatus: evidence.lastStatus.trim(),
        lastOutboundText: evidence.lastOutboundText.trim(),
        updatedAtIso: evidence.updatedAtIso.trim(),
        handoffReasonCode: evidence.handoffReasonCode?.trim() || undefined,
        handoffQueue: evidence.handoffQueue?.trim() || undefined,
      });
    },
    listHandoffs(): WhatsAppHandoffRecord[] {
      return Array.from(handoffsById.values()).sort(
        (left, right) => left.createdAtIso.localeCompare(right.createdAtIso)
      );
    },
    saveHandoff(record: WhatsAppHandoffRecord): void {
      const normalized = normalizeHandoffRecord(record);
      handoffsById.set(normalized.handoffId, normalized);
    },

    listConversationEvents(customerId: string): WhatsAppConversationEvent[] {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be a non-empty string");
      }

      return [...(eventsByCustomerId.get(customerId.trim()) ?? [])].sort((left, right) =>
        left.occurredAtIso.localeCompare(right.occurredAtIso)
      );
    },

    saveConversationEvent(event: WhatsAppConversationEvent): void {
      const normalized = normalizeConversationEvent(event);
      const existing = eventsByCustomerId.get(normalized.customerId) ?? [];
      const withoutDuplicate = existing.filter((item) => item.eventId !== normalized.eventId);
      eventsByCustomerId.set(normalized.customerId, [...withoutDuplicate, normalized]);
    },
  };
}