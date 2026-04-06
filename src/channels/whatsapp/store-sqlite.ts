import { DatabaseSync } from "node:sqlite";
import { createInitialSessionState, type SessionState } from "../../session-state/session-state";
import type { WhatsAppConversationEvidence, WhatsAppHandoffRecord, WhatsAppStore } from "./store";

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

    CREATE TABLE IF NOT EXISTS whatsapp_handoffs (
      handoff_id TEXT PRIMARY KEY,
      handoff_json TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );
  `);

  const selectSession = db.prepare(`
    SELECT session_json FROM whatsapp_sessions WHERE customer_id = ?
  `);

  const upsertSession = db.prepare(`
    INSERT INTO whatsapp_sessions ( customer_id, session_json, updated_at_iso )
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      session_json = excluded.session_json,
      updated_at_iso = excluded.updated_at_iso
  `);

  const selectProcessedMessage = db.prepare(`
    SELECT 1 FROM whatsapp_processed_messages WHERE channel_message_id = ?
  `);

  const insertProcessedMessage = db.prepare(`
    INSERT OR IGNORE INTO whatsapp_processed_messages ( channel_message_id, processed_at_iso )
    VALUES (?, ?)
  `);

  const selectEvidence = db.prepare(`
    SELECT evidence_json FROM whatsapp_conversation_evidence WHERE customer_id = ?
  `);

  const upsertEvidence = db.prepare(`
    INSERT INTO whatsapp_conversation_evidence ( customer_id, evidence_json, updated_at_iso )
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      evidence_json = excluded.evidence_json,
      updated_at_iso = excluded.updated_at_iso
  `);

  const selectAllHandoffs = db.prepare(`
    SELECT handoff_json FROM whatsapp_handoffs ORDER BY created_at_iso ASC, handoff_id ASC
  `);

  const upsertHandoff = db.prepare(`
    INSERT INTO whatsapp_handoffs ( handoff_id, handoff_json, created_at_iso, updated_at_iso )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(handoff_id) DO UPDATE SET
      handoff_json = excluded.handoff_json,
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

    listHandoffs(): WhatsAppHandoffRecord[] {
      const rows = selectAllHandoffs.all() as Array<{ handoff_json?: string }>;
      return rows
        .filter((row) => isNonEmptyString(row.handoff_json))
        .map((row) => JSON.parse(row.handoff_json!) as WhatsAppHandoffRecord);
    },

    saveHandoff(record: WhatsAppHandoffRecord): void {
      const normalized = normalizeHandoffRecord(record);
      upsertHandoff.run(
        normalized.handoffId,
        JSON.stringify(normalized),
        normalized.createdAtIso,
        normalized.updatedAtIso
      );
    },

    close(): void {
      db.close();
    },
  };
}