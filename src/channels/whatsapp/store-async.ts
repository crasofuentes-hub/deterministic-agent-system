import type { SessionState } from "../../session-state/session-state";
import type {
  WhatsAppConversationEvent,
  WhatsAppConversationEvidence,
  WhatsAppHandoffRecord,
  WhatsAppStore,
} from "./store";

export interface AsyncWhatsAppStore {
  loadSession(customerId: string): Promise<SessionState>;
  saveSession(customerId: string, session: SessionState): Promise<void>;
  hasProcessedMessage(channelMessageId: string): Promise<boolean>;
  markMessageProcessed(channelMessageId: string): Promise<void>;
  loadEvidence(customerId: string): Promise<WhatsAppConversationEvidence | undefined>;
  saveEvidence(evidence: WhatsAppConversationEvidence): Promise<void>;
  listHandoffs(): Promise<WhatsAppHandoffRecord[]>;
  saveHandoff(record: WhatsAppHandoffRecord): Promise<void>;
  listConversationEvents(customerId: string): Promise<WhatsAppConversationEvent[]>;
  saveConversationEvent(event: WhatsAppConversationEvent): Promise<void>;
}

export function adaptSyncWhatsAppStoreToAsync(store: WhatsAppStore): AsyncWhatsAppStore {
  return {
    async loadSession(customerId: string): Promise<SessionState> {
      return store.loadSession(customerId);
    },

    async saveSession(customerId: string, session: SessionState): Promise<void> {
      store.saveSession(customerId, session);
    },

    async hasProcessedMessage(channelMessageId: string): Promise<boolean> {
      return store.hasProcessedMessage(channelMessageId);
    },

    async markMessageProcessed(channelMessageId: string): Promise<void> {
      store.markMessageProcessed(channelMessageId);
    },

    async loadEvidence(customerId: string): Promise<WhatsAppConversationEvidence | undefined> {
      return store.loadEvidence(customerId);
    },

    async saveEvidence(evidence: WhatsAppConversationEvidence): Promise<void> {
      store.saveEvidence(evidence);
    },

    async listHandoffs(): Promise<WhatsAppHandoffRecord[]> {
      return store.listHandoffs();
    },

    async saveHandoff(record: WhatsAppHandoffRecord): Promise<void> {
      store.saveHandoff(record);
    },

    async listConversationEvents(customerId: string): Promise<WhatsAppConversationEvent[]> {
      return store.listConversationEvents(customerId);
    },

    async saveConversationEvent(event: WhatsAppConversationEvent): Promise<void> {
      store.saveConversationEvent(event);
    },
  };
}