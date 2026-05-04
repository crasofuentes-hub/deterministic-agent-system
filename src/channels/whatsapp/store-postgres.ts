import { createInitialSessionState, type SessionState } from "../../session-state/session-state";
import type { DeterministicPostgresPool } from "../../storage/postgres-pool";
import type { AsyncWhatsAppStore } from "./store-async";
import type {
  WhatsAppConversationEvent,
  WhatsAppConversationEvidence,
  WhatsAppHandoffRecord,
} from "./store";

export interface PostgresWhatsAppStoreOptions {
  readonly pool: DeterministicPostgresPool;
  readonly businessContextId: string;
  readonly sessionIdPrefix?: string;
  readonly processedAtIso?: string;
}

export interface PostgresWhatsAppStore extends AsyncWhatsAppStore {
  close(): Promise<void>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readRequiredString(value: string | undefined, name: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function readJsonValue<T>(value: unknown): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function normalizeCustomerId(customerId: string): string {
  return readRequiredString(customerId, "customerId");
}

function normalizeChannelMessageId(channelMessageId: string): string {
  return readRequiredString(channelMessageId, "channelMessageId");
}

export function createPostgresWhatsAppStore(
  options: PostgresWhatsAppStoreOptions
): PostgresWhatsAppStore {
  const businessContextId = readRequiredString(options.businessContextId, "businessContextId");
  const sessionIdPrefix = isNonEmptyString(options.sessionIdPrefix)
    ? options.sessionIdPrefix.trim()
    : "whatsapp-session";
  const processedAtIso = isNonEmptyString(options.processedAtIso)
    ? options.processedAtIso.trim()
    : "2026-03-24T00:00:00.000Z";

  return {
    async loadSession(customerId: string): Promise<SessionState> {
      const key = normalizeCustomerId(customerId);
      const result = await options.pool.query<{ session_json?: unknown }>(
        `
SELECT session_json
FROM whatsapp_sessions
WHERE customer_id = $1
`.trim(),
        [key]
      );

      const session = readJsonValue<SessionState>(result.rows[0]?.session_json);

      if (session) {
        return session;
      }

      return createInitialSessionState({
        sessionId: sessionIdPrefix + ":" + key,
        businessContextId,
      });
    },

    async saveSession(customerId: string, session: SessionState): Promise<void> {
      const key = normalizeCustomerId(customerId);

      await options.pool.query(
        `
INSERT INTO whatsapp_sessions (customer_id, session_json, updated_at_iso)
VALUES ($1, $2::jsonb, $3)
ON CONFLICT (customer_id) DO UPDATE SET
  session_json = excluded.session_json,
  updated_at_iso = excluded.updated_at_iso
`.trim(),
        [key, JSON.stringify(session), processedAtIso]
      );
    },

    async hasProcessedMessage(channelMessageId: string): Promise<boolean> {
      const key = normalizeChannelMessageId(channelMessageId);
      const result = await options.pool.query<{ channel_message_id?: string }>(
        `
SELECT channel_message_id
FROM whatsapp_processed_messages
WHERE channel_message_id = $1
`.trim(),
        [key]
      );

      return result.rows.length > 0;
    },

    async markMessageProcessed(channelMessageId: string): Promise<void> {
      const key = normalizeChannelMessageId(channelMessageId);

      await options.pool.query(
        `
INSERT INTO whatsapp_processed_messages (channel_message_id, processed_at_iso)
VALUES ($1, $2)
ON CONFLICT (channel_message_id) DO NOTHING
`.trim(),
        [key, processedAtIso]
      );
    },

    async loadEvidence(customerId: string): Promise<WhatsAppConversationEvidence | undefined> {
      const key = normalizeCustomerId(customerId);
      const result = await options.pool.query<{ evidence_json?: unknown }>(
        `
SELECT evidence_json
FROM whatsapp_conversation_evidence
WHERE customer_id = $1
`.trim(),
        [key]
      );

      return readJsonValue<WhatsAppConversationEvidence>(result.rows[0]?.evidence_json);
    },

    async saveEvidence(evidence: WhatsAppConversationEvidence): Promise<void> {
      const key = normalizeCustomerId(evidence.customerId);

      await options.pool.query(
        `
INSERT INTO whatsapp_conversation_evidence (customer_id, evidence_json, updated_at_iso)
VALUES ($1, $2::jsonb, $3)
ON CONFLICT (customer_id) DO UPDATE SET
  evidence_json = excluded.evidence_json,
  updated_at_iso = excluded.updated_at_iso
`.trim(),
        [key, JSON.stringify(evidence), evidence.updatedAtIso]
      );
    },

    async listHandoffs(): Promise<WhatsAppHandoffRecord[]> {
      const result = await options.pool.query<{ handoff_json?: unknown }>(
        `
SELECT handoff_json
FROM whatsapp_handoffs
ORDER BY created_at_iso ASC, handoff_id ASC
`.trim()
      );

      return result.rows
        .map((row) => readJsonValue<WhatsAppHandoffRecord>(row.handoff_json))
        .filter((row): row is WhatsAppHandoffRecord => row !== undefined);
    },

    async saveHandoff(record: WhatsAppHandoffRecord): Promise<void> {
      await options.pool.query(
        `
INSERT INTO whatsapp_handoffs (
  handoff_id,
  customer_id,
  handoff_json,
  created_at_iso,
  updated_at_iso
)
VALUES ($1, $2, $3::jsonb, $4, $5)
ON CONFLICT (handoff_id) DO UPDATE SET
  handoff_json = excluded.handoff_json,
  updated_at_iso = excluded.updated_at_iso
`.trim(),
        [
          readRequiredString(record.handoffId, "handoffId"),
          normalizeCustomerId(record.customerId),
          JSON.stringify(record),
          readRequiredString(record.createdAtIso, "createdAtIso"),
          readRequiredString(record.updatedAtIso, "updatedAtIso"),
        ]
      );
    },

    async listConversationEvents(customerId: string): Promise<WhatsAppConversationEvent[]> {
      const key = normalizeCustomerId(customerId);
      const result = await options.pool.query<{ event_json?: unknown }>(
        `
SELECT event_json
FROM whatsapp_conversation_events
WHERE customer_id = $1
ORDER BY occurred_at_iso ASC, event_id ASC
`.trim(),
        [key]
      );

      return result.rows
        .map((row) => readJsonValue<WhatsAppConversationEvent>(row.event_json))
        .filter((row): row is WhatsAppConversationEvent => row !== undefined);
    },

    async saveConversationEvent(event: WhatsAppConversationEvent): Promise<void> {
      await options.pool.query(
        `
INSERT INTO whatsapp_conversation_events (
  event_id,
  customer_id,
  occurred_at_iso,
  event_json
)
VALUES ($1, $2, $3, $4::jsonb)
ON CONFLICT (event_id) DO UPDATE SET
  event_json = excluded.event_json
`.trim(),
        [
          readRequiredString(event.eventId, "eventId"),
          normalizeCustomerId(event.customerId),
          readRequiredString(event.occurredAtIso, "occurredAtIso"),
          JSON.stringify(event),
        ]
      );
    },

    async close(): Promise<void> {
      await options.pool.close();
    },
  };
}