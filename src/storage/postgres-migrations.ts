import type { DeterministicPostgresPool } from "./postgres-pool";

export interface PostgresMigration {
  readonly id: string;
  readonly sql: string;
}

export const POSTGRES_MIGRATIONS: readonly PostgresMigration[] = [
  {
    id: "0001_whatsapp_store_foundation",
    sql: `
CREATE TABLE IF NOT EXISTS det_agent_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  customer_id TEXT PRIMARY KEY,
  session_json JSONB NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  channel_message_id TEXT PRIMARY KEY,
  processed_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_evidence (
  customer_id TEXT PRIMARY KEY,
  evidence_json JSONB NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_handoffs (
  handoff_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  handoff_json JSONB NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_events (
  event_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  occurred_at_iso TEXT NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_handoffs_created
  ON whatsapp_handoffs (created_at_iso ASC, handoff_id ASC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_events_customer_order
  ON whatsapp_conversation_events (customer_id ASC, occurred_at_iso ASC, event_id ASC);
`.trim(),
  },
];

export function listPostgresMigrations(): readonly PostgresMigration[] {
  return POSTGRES_MIGRATIONS;
}

export async function applyPostgresMigrations(
  pool: DeterministicPostgresPool,
  appliedAtIso: string
): Promise<void> {
  const normalizedAppliedAtIso = appliedAtIso.trim();

  if (!normalizedAppliedAtIso) {
    throw new Error("appliedAtIso must be a non-empty string");
  }

  for (const migration of POSTGRES_MIGRATIONS) {
    await pool.query(migration.sql);
    await pool.query(
      `
INSERT INTO det_agent_schema_migrations (id, applied_at_iso)
VALUES ($1, $2)
ON CONFLICT (id) DO NOTHING
`.trim(),
      [migration.id, normalizedAppliedAtIso]
    );
  }
}