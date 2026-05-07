import type { DeterministicPostgresPool } from "../storage/postgres-pool";
import { hashJournalEventContent, verifyJournalEventChain } from "./hash";
import type {
  AppendJournalEventInput,
  ExecutionJournal,
  GetSessionJournalOptions,
  JournalEventType,
  SessionJournal,
  StoredJournalEvent,
} from "./types";

export interface PostgresExecutionJournalOptions {
  readonly pool: DeterministicPostgresPool;
}

export interface PostgresExecutionJournalMigration {
  readonly id: string;
  readonly sql: string;
}

interface LatestJournalRow {
  readonly sequence: number;
  readonly hash_self: string;
}

interface StoredJournalEventRow {
  readonly event_id: string;
  readonly session_id: string;
  readonly sequence: number;
  readonly timestamp_iso: string;
  readonly event_type: string;
  readonly payload_json: Record<string, unknown>;
  readonly metadata_json: Record<string, unknown> | null;
  readonly hash_prev: string | null;
  readonly hash_self: string;
}

const JOURNAL_EVENT_TYPES = new Set<string>([
  "plan",
  "tool_call",
  "tool_result",
  "llm_response",
  "message_received",
  "message_processed",
  "handoff",
  "error",
  "convergence",
]);

const SCHEMA_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS det_agent_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at_iso TEXT NOT NULL
);
`;

export const POSTGRES_EXECUTION_JOURNAL_MIGRATIONS: readonly PostgresExecutionJournalMigration[] = [
  {
    id: "0002_execution_journal_events",
    sql: `
CREATE TABLE IF NOT EXISTS execution_journal_events (
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  timestamp_iso TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  metadata_json JSONB,
  hash_prev TEXT,
  hash_self TEXT NOT NULL,
  PRIMARY KEY (session_id, sequence),
  UNIQUE (session_id, event_id)
);

CREATE INDEX IF NOT EXISTS execution_journal_events_session_id_idx
  ON execution_journal_events (session_id);

CREATE INDEX IF NOT EXISTS execution_journal_events_event_id_idx
  ON execution_journal_events (event_id);
`,
  },
];

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function cloneJsonRecord(value: Record<string, unknown>, name: string): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    throw new Error(name + " must be JSON-compatible");
  }
}

function readJournalEventType(value: string): JournalEventType {
  if (!JOURNAL_EVENT_TYPES.has(value)) {
    throw new Error("Unknown journal event type: " + value);
  }

  return value as JournalEventType;
}

function toStoredEvent(row: StoredJournalEventRow): StoredJournalEvent {
  const metadata =
    row.metadata_json === null ? undefined : cloneJsonRecord(row.metadata_json, "metadata");

  return {
    eventId: row.event_id,
    sessionId: row.session_id,
    sequence: row.sequence,
    timestamp: row.timestamp_iso,
    type: readJournalEventType(row.event_type),
    payload: cloneJsonRecord(row.payload_json, "payload"),
    hashPrev: row.hash_prev,
    hashSelf: row.hash_self,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

async function loadSessionEvents(
  pool: DeterministicPostgresPool,
  sessionId: string,
): Promise<StoredJournalEvent[]> {
  const result = await pool.query<StoredJournalEventRow>(
    `
SELECT
  event_id,
  session_id,
  sequence,
  timestamp_iso,
  event_type,
  payload_json,
  metadata_json,
  hash_prev,
  hash_self
FROM execution_journal_events
WHERE session_id = $1
ORDER BY sequence ASC
`,
    [sessionId],
  );

  return result.rows.map((row) => toStoredEvent(row));
}

export async function applyPostgresExecutionJournalMigrations(
  pool: DeterministicPostgresPool,
  appliedAtIso = "2026-05-06T00:00:00.000Z",
): Promise<void> {
  const normalizedAppliedAtIso = readNonEmptyString(appliedAtIso, "appliedAtIso");

  await pool.query(SCHEMA_MIGRATIONS_TABLE_SQL);

  for (const migration of POSTGRES_EXECUTION_JOURNAL_MIGRATIONS) {
    const existing = await pool.query<{ readonly id: string }>(
      "SELECT id FROM det_agent_schema_migrations WHERE id = $1",
      [migration.id],
    );

    if (existing.rows.length > 0) {
      continue;
    }

    await pool.query(migration.sql);

    await pool.query(
      "INSERT INTO det_agent_schema_migrations (id, applied_at_iso) VALUES ($1, $2)",
      [migration.id, normalizedAppliedAtIso],
    );
  }
}

export function createPostgresExecutionJournal(
  options: PostgresExecutionJournalOptions,
): ExecutionJournal {
  const pool = options.pool;

  return {
    async appendEvent(event: AppendJournalEventInput): Promise<StoredJournalEvent> {
      const eventId = readNonEmptyString(event.eventId, "eventId");
      const sessionId = readNonEmptyString(event.sessionId, "sessionId");
      const timestamp = readNonEmptyString(event.timestamp, "timestamp");
      const payload = cloneJsonRecord(event.payload, "payload");
      const metadata =
        event.metadata === undefined ? undefined : cloneJsonRecord(event.metadata, "metadata");

      const latest = await pool.query<LatestJournalRow>(
        `
SELECT sequence, hash_self
FROM execution_journal_events
WHERE session_id = $1
ORDER BY sequence DESC
LIMIT 1
`,
        [sessionId],
      );

      const previous = latest.rows[0];
      const sequence = previous ? Number(previous.sequence) + 1 : 1;
      const hashPrev = previous?.hash_self ?? null;

      const hashSelf = hashJournalEventContent({
        eventId,
        sessionId,
        sequence,
        timestamp,
        type: event.type,
        payload,
        hashPrev,
        metadata,
      });

      await pool.query(
        `
INSERT INTO execution_journal_events (
  session_id,
  sequence,
  event_id,
  timestamp_iso,
  event_type,
  payload_json,
  metadata_json,
  hash_prev,
  hash_self
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
`,
        [
          sessionId,
          sequence,
          eventId,
          timestamp,
          event.type,
          JSON.stringify(payload),
          metadata === undefined ? null : JSON.stringify(metadata),
          hashPrev,
          hashSelf,
        ],
      );

      return {
        eventId,
        sessionId,
        sequence,
        timestamp,
        type: event.type,
        payload,
        hashPrev,
        hashSelf,
        ...(metadata === undefined ? {} : { metadata }),
      };
    },

    async verifyChain(sessionId: string): Promise<boolean> {
      const normalizedSessionId = readNonEmptyString(sessionId, "sessionId");
      const events = await loadSessionEvents(pool, normalizedSessionId);

      return verifyJournalEventChain(events);
    },

    async getSessionJournal(
      sessionId: string,
      options: GetSessionJournalOptions = {},
    ): Promise<SessionJournal> {
      const normalizedSessionId = readNonEmptyString(sessionId, "sessionId");
      const events = await loadSessionEvents(pool, normalizedSessionId);

      return {
        sessionId: normalizedSessionId,
        events,
        ...(options.integrityCheck === true ? { integrityOk: verifyJournalEventChain(events) } : {}),
      };
    },
  };
}