import { createInitialSessionState, type SessionState } from "../../session-state/session-state";

export interface WhatsAppStore {
  loadSession(customerId: string): SessionState;
  saveSession(customerId: string, session: SessionState): void;
  hasProcessedMessage(channelMessageId: string): boolean;
  markMessageProcessed(channelMessageId: string): void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  const sessionIdPrefix = isNonEmptyString(options.sessionIdPrefix)
    ? options.sessionIdPrefix.trim()
    : "whatsapp-session";

  const sessions = new Map<string, SessionState>();
  const processedMessageIds = new Set<string>();

  return {
    loadSession(customerId: string): SessionState {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be a non-empty string");
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
        throw new Error("customerId must be a non-empty string");
      }

      sessions.set(customerId.trim(), session);
    },

    hasProcessedMessage(channelMessageId: string): boolean {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be a non-empty string");
      }

      return processedMessageIds.has(channelMessageId.trim());
    },

    markMessageProcessed(channelMessageId: string): void {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be a non-empty string");
      }

      processedMessageIds.add(channelMessageId.trim());
    },
  };
}
