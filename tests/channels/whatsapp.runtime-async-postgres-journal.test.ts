import { describe, expect, it } from "vitest";
import { resolveAsyncWhatsAppRuntime } from "../../src/channels/whatsapp/runtime-async";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";
import type {
  DeterministicPostgresPool,
  PostgresQueryResult,
} from "../../src/storage/postgres-pool";
import { replaySession } from "../../src/replay";

interface QueryRecord {
  readonly sql: string;
  readonly values?: readonly unknown[];
}

interface EventRow {
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

class FakeRuntimePostgresPool implements DeterministicPostgresPool {
  readonly config: PostgresPoolConfig = {
    connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
    maxConnections: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
    statementTimeoutMillis: 1000,
  };

  readonly queries: QueryRecord[] = [];
  readonly migrations = new Set<string>();
  readonly events: EventRow[] = [];
  closed = false;

  async query<Row = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<Row>> {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    this.queries.push({ sql, values });

    if (normalized.startsWith("create table") || normalized.startsWith("create index")) {
      return { rows: [], rowCount: 0 };
    }

    if (normalized.includes("select id from det_agent_schema_migrations")) {
      const id = String(values?.[0] ?? "");
      const rows = this.migrations.has(id) ? [{ id }] : [];
      return { rows: rows as Row[], rowCount: rows.length };
    }

    if (normalized.includes("insert into det_agent_schema_migrations")) {
      const id = String(values?.[0] ?? "");
      this.migrations.add(id);
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.includes("select sequence, hash_self") &&
      normalized.includes("from execution_journal_events")
    ) {
      const sessionId = String(values?.[0] ?? "");
      const rows = this.events
        .filter((event) => event.session_id === sessionId)
        .sort((left, right) => right.sequence - left.sequence)
        .slice(0, 1)
        .map((event) => ({
          sequence: event.sequence,
          hash_self: event.hash_self,
        }));

      return { rows: rows as Row[], rowCount: rows.length };
    }

    if (normalized.includes("insert into execution_journal_events")) {
      const [
        sessionId,
        sequence,
        eventId,
        timestampIso,
        eventType,
        payloadJson,
        metadataJson,
        hashPrev,
        hashSelf,
      ] = values ?? [];

      this.events.push({
        session_id: String(sessionId),
        sequence: Number(sequence),
        event_id: String(eventId),
        timestamp_iso: String(timestampIso),
        event_type: String(eventType),
        payload_json: JSON.parse(String(payloadJson)) as Record<string, unknown>,
        metadata_json:
          metadataJson === null || typeof metadataJson === "undefined"
            ? null
            : (JSON.parse(String(metadataJson)) as Record<string, unknown>),
        hash_prev: hashPrev === null ? null : String(hashPrev),
        hash_self: String(hashSelf),
      });

      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.includes("select event_id, session_id, sequence") &&
      normalized.includes("from execution_journal_events")
    ) {
      const sessionId = String(values?.[0] ?? "");
      const rows = this.events
        .filter((event) => event.session_id === sessionId)
        .sort((left, right) => left.sequence - right.sequence);

      return { rows: rows as Row[], rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe("async whatsapp runtime postgres execution journal", () => {
  it("uses the postgres execution journal when postgres store mode is enabled", async () => {
    const fakePool = new FakeRuntimePostgresPool();
    const configs: PostgresPoolConfig[] = [];

    const runtime = await resolveAsyncWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token",
        WHATSAPP_STORE_MODE: "postgres",
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_MIGRATION_APPLIED_AT_ISO: "2026-05-06T00:00:00.000Z",
      },
      createPostgresPool(config) {
        configs.push(config);
        return fakePool;
      },
    });

    try {
      expect(configs).toHaveLength(1);
      expect(fakePool.migrations.has("0002_execution_journal_events")).toBe(true);

      const received = await runtime.journal.appendEvent({
        eventId: "evt-runtime-pg-journal-001",
        sessionId: "whatsapp:5215512345678",
        timestamp: "2026-05-06T01:00:00.000Z",
        type: "message_received",
        payload: {
          channel: "whatsapp",
          customerId: "5215512345678",
          channelMessageId: "wamid.runtime.pg.journal.001",
          text: "Coverage details for POL-AUTO-1001",
        },
      });

      const processed = await runtime.journal.appendEvent({
        eventId: "evt-runtime-pg-journal-002",
        sessionId: "whatsapp:5215512345678",
        timestamp: "2026-05-06T01:00:01.000Z",
        type: "message_processed",
        payload: {
          channel: "whatsapp",
          customerId: "5215512345678",
          channelMessageId: "wamid.runtime.pg.journal.001",
          duplicate: false,
          deliveryStatus: "skipped",
          responseId: "consult-coverage-resolved",
          resolvedIntentId: "consult-coverage",
          stage: "resolve-coverage",
          status: "resolved",
          humanInterventionRequired: false,
        },
      });

      expect(received).toMatchObject({
        sequence: 1,
        hashPrev: null,
      });

      expect(processed).toMatchObject({
        sequence: 2,
        hashPrev: received.hashSelf,
      });

      await expect(runtime.journal.verifyChain("whatsapp:5215512345678")).resolves.toBe(true);

      const replay = await replaySession(runtime.journal, "whatsapp:5215512345678");

      expect(replay).toMatchObject({
        ok: true,
        sessionId: "whatsapp:5215512345678",
        integrityOk: true,
        replayedUntilSequence: 2,
        eventsReplayed: 2,
        finalState: {
          eventCount: 2,
          eventTypes: {
            message_received: 1,
            message_processed: 1,
          },
          lastEventId: "evt-runtime-pg-journal-002",
          lastEventType: "message_processed",
          lastSequence: 2,
        },
      });

      if (!replay.ok) {
        throw new Error("Expected replay to succeed");
      }

      expect(replay.replayHash).toMatch(/^[a-f0-9]{64}$/);
      expect(fakePool.events).toHaveLength(2);
    } finally {
      await runtime.close();
    }

    expect(fakePool.closed).toBe(true);
  });
});