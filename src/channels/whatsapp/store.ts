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

export interface WhatsAppStore {
  loadSession(customerId: string): SessionState;
  saveSession(customerId: string, session: SessionState): void;
  hasProcessedMessage(channelMessageId: string): boolean;
  markMessageProcessed(channelMessageId: string): void;
  loadEvidence(customerId: string): WhatsAppConversationEvidence | undefined;
  saveEvidence(evidence: WhatsAppConversationEvidence): void;
  listHandoffs(): WhatsAppHandoffRecord[];
  saveHandoff(record: WhatsAppHandoffRecord): void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  };
}