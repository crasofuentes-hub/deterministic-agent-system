import { DatabaseSync } from "node:sqlite";
import { createInitialSessionState, type SessionState } from "../../session-state/session-state";
import type { WhatsAppConversationEvidence, WhatsAppStore } from "./store";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export interface SqliteWhatsAppStoreOptions {
  dbPath: string;
  businessContextId: string;
  sessionIdPrefix?: string;
}

export interface SqliteWhatsAppStore extends WhatsAppStore {
  close(): void;
}

function openDatabase(dbPath: string): DatabaseSync {
  return new DatabaseSync(dbPath);
}

export function createSqliteWhatsAppStore(
  options: SqliteWhatsAppStoreOptions
): SqliteWhatsAppStore {
  if (!isNonEmptyString(options.dbPath)) {
    throw new Error("dbPath must be a non-empty string");
  }

  if (!isNonEmptyString(options.businessContextId)) {
    throw new Error("businessContextId must be a non-empty string");
  }

  const businessContextId = options.businessContextId.trim();
  const sessionIdPrefix = isNonEmptyString(options.sessionIdPrefix)
    ? options.sessionIdPrefix.trim()
    : "whatsapp-session";

  const db = openDatabase(options.dbPath.trim());

  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      customer_id TEXT PRIMARY KEY,
      session_json TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
      channel_message_id TEXT PRIMARY KEY,
      processed_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_conversation_evidence (
      customer_id TEXT PRIMARY KEY,
      evidence_json TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );
  `);

  const selectSession = db.prepare(`
    SELECT session_json
    FROM whatsapp_sessions
    WHERE customer_id = ?
  `);

  const upsertSession = db.prepare(`
    INSERT INTO whatsapp_sessions (
      customer_id,
      session_json,
      updated_at_iso
    )
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      session_json = excluded.session_json,
      updated_at_iso = excluded.updated_at_iso
  `);

  const selectProcessedMessage = db.prepare(`
    SELECT 1
    FROM whatsapp_processed_messages
    WHERE channel_message_id = ?
  `);

  const insertProcessedMessage = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_processed_messages (
      channel_message_id,
      processed_at_iso
    )
    VALUES (?, ?)
  `);

  const selectEvidence = db.prepare(`
    SELECT evidence_json
    FROM whatsapp_conversation_evidence
    WHERE customer_id = ?
  `);

  const upsertEvidence = db.prepare(`
    INSERT INTO whatsapp_conversation_evidence (
      customer_id,
      evidence_json,
      updated_at_iso
    )
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      evidence_json = excluded.evidence_json,
      updated_at_iso = excluded.updated_at_iso
  `);

  return {
    loadSession(customerId: string): SessionState {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be a non-empty string");
      }

      const key = customerId.trim();
      const row = selectSession.get(key) as { session_json?: string } | undefined;

      if (!row || !isNonEmptyString(row.session_json)) {
        return createInitialSessionState({
          sessionId: sessionIdPrefix + ":" + key,
          businessContextId,
        });
      }

      return JSON.parse(row.session_json) as SessionState;
    },

    saveSession(customerId: string, session: SessionState): void {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be a non-empty string");
      }

      const key = customerId.trim();
      upsertSession.run(key, JSON.stringify(session), "2026-03-24T00:00:00.000Z");
    },

    hasProcessedMessage(channelMessageId: string): boolean {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be a non-empty string");
      }

      const row = selectProcessedMessage.get(channelMessageId.trim()) as { 1?: number } | undefined;

      return !!row;
    },

    markMessageProcessed(channelMessageId: string): void {
      if (!isNonEmptyString(channelMessageId)) {
        throw new Error("channelMessageId must be a non-empty string");
      }

      insertProcessedMessage.run(channelMessageId.trim(), "2026-03-24T00:00:00.000Z");
    },

    loadEvidence(customerId: string): WhatsAppConversationEvidence | undefined {
      if (!isNonEmptyString(customerId)) {
        throw new Error("customerId must be a non-empty string");
      }

      const row = selectEvidence.get(customerId.trim()) as { evidence_json?: string } | undefined;

      if (!row || !isNonEmptyString(row.evidence_json)) {
        return undefined;
      }

      return JSON.parse(row.evidence_json) as WhatsAppConversationEvidence;
    },

    saveEvidence(evidence: WhatsAppConversationEvidence): void {
      if (!isNonEmptyString(evidence.customerId)) {
        throw new Error("customerId must be a non-empty string");
      }

      const normalized: WhatsAppConversationEvidence = {
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
      };

      upsertEvidence.run(
        normalized.customerId,
        JSON.stringify(normalized),
        normalized.updatedAtIso
      );
    },

    close(): void {
      db.close();
    },
  };
}
