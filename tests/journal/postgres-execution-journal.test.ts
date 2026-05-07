import { describe, expect, it } from "vitest";
import type { DeterministicPostgresPool } from "../../src/storage/postgres-pool";
import {
  applyPostgresExecutionJournalMigrations,
  createPostgresExecutionJournal,
  type StoredJournalEvent,
} from "../../src/journal";
import { replaySession } from "../../src/replay";

interface QueryRecord {
  readonly sql: string;
  readonly values?: readonly unknown[];
}

interface MigrationRow {
  readonly id: string;
}

interface LatestRow {
  readonly sequence: number;
  readonly hash_self: string;
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

class FakePostgresJournalPool {
  readonly queries: QueryRecord[] = [];
  readonly migrations = new Set<string>();
  readonly events: EventRow[] = [];
  closed = false;

  async query<Row = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }> {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    this.queries.push({ sql, values });

    if (normalized.startsWith("create table if not exists det_agent_schema_migrations")) {
      return { rows: [] };
    }

    if (normalized.includes("select id from det_agent_schema_migrations")) {
      const id = String(values?.[0] ?? "");
      const rows = this.migrations.has(id) ? [{ id }] : [];
      return { rows: rows as Row[] };
    }

    if (normalized.includes("insert into det_agent_schema_migrations")) {
      const id = String(values?.[0] ?? "");
      this.migrations.add(id);
      return { rows: [] };
    }

    if (normalized.includes("create table if not exists execution_journal_events")) {
      return { rows: [] };
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

      return { rows: rows as Row[] };
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

      const row: EventRow = {
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
      };

      const duplicate = this.events.some(
        (event) =>
          event.session_id === row.session_id &&
          (event.sequence === row.sequence || event.event_id === row.event_id),
      );

      if (duplicate) {
        throw new Error("duplicate journal event");
      }

      this.events.push(row);
      return { rows: [] };
    }

    if (
      normalized.includes("select event_id, session_id, sequence") &&
      normalized.includes("from execution_journal_events")
    ) {
      const sessionId = String(values?.[0] ?? "");
      const rows = this.events
        .filter((event) => event.session_id === sessionId)
        .sort((left, right) => left.sequence - right.sequence);

      return { rows: rows as Row[] };
    }

    throw new Error("Unhandled SQL in fake postgres journal pool: " + normalized);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function asPool(fake: FakePostgresJournalPool): DeterministicPostgresPool {
  return fake as unknown as DeterministicPostgresPool;
}

describe("postgres execution journal", () => {
  it("applies execution journal migrations idempotently", async () => {
    const fake = new FakePostgresJournalPool();

    await applyPostgresExecutionJournalMigrations(
      asPool(fake),
      "2026-05-06T00:00:00.000Z",
    );
    await applyPostgresExecutionJournalMigrations(
      asPool(fake),
      "2026-05-06T00:00:00.000Z",
    );

    expect([...fake.migrations]).toEqual(["0002_execution_journal_events"]);

    const createTableQueries = fake.queries.filter((query) =>
      query.sql.includes("CREATE TABLE IF NOT EXISTS execution_journal_events"),
    );

    expect(createTableQueries).toHaveLength(1);
  });

  it("persists journal events with hashPrev and hashSelf through postgres", async () => {
    const fake = new FakePostgresJournalPool();
    const journal = createPostgresExecutionJournal({ pool: asPool(fake) });

    const first = await journal.appendEvent({
      eventId: "evt-pg-001",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T01:00:00.000Z",
      type: "message_received",
      payload: {
        channel: "whatsapp",
        text: "hello",
      },
    });

    const second = await journal.appendEvent({
      eventId: "evt-pg-002",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T01:00:01.000Z",
      type: "message_processed",
      payload: {
        channel: "whatsapp",
        duplicate: false,
        deliveryStatus: "skipped",
      },
      metadata: {
        requestId: "req-pg-001",
      },
    });

    expect(first).toMatchObject({
      sequence: 1,
      hashPrev: null,
    });

    expect(second).toMatchObject({
      sequence: 2,
      hashPrev: first.hashSelf,
    });

    await expect(journal.verifyChain("whatsapp:5215512345678")).resolves.toBe(true);

    await expect(
      journal.getSessionJournal("whatsapp:5215512345678", { integrityCheck: true }),
    ).resolves.toMatchObject({
      sessionId: "whatsapp:5215512345678",
      integrityOk: true,
      events: [
        {
          eventId: "evt-pg-001",
          sequence: 1,
          type: "message_received",
          hashPrev: null,
        },
        {
          eventId: "evt-pg-002",
          sequence: 2,
          type: "message_processed",
          hashPrev: first.hashSelf,
          metadata: {
            requestId: "req-pg-001",
          },
        },
      ],
    });
  });

  it("detects tampered postgres journal rows", async () => {
    const fake = new FakePostgresJournalPool();
    const journal = createPostgresExecutionJournal({ pool: asPool(fake) });

    await journal.appendEvent({
      eventId: "evt-pg-tamper-001",
      sessionId: "session-tamper",
      timestamp: "2026-05-06T02:00:00.000Z",
      type: "error",
      payload: {
        code: "ORIGINAL",
      },
    });

    fake.events[0] = {
      ...fake.events[0]!,
      payload_json: {
        code: "TAMPERED",
      },
    };

    await expect(journal.verifyChain("session-tamper")).resolves.toBe(false);

    await expect(
      journal.getSessionJournal("session-tamper", { integrityCheck: true }),
    ).resolves.toMatchObject({
      sessionId: "session-tamper",
      integrityOk: false,
    });
  });

  it("supports journal replay from the postgres execution journal adapter", async () => {
    const fake = new FakePostgresJournalPool();
    const journal = createPostgresExecutionJournal({ pool: asPool(fake) });

    await journal.appendEvent({
      eventId: "evt-pg-replay-001",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T03:00:00.000Z",
      type: "message_received",
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.pg.replay.001",
        text: "Coverage details for POL-AUTO-1001",
      },
    });

    await journal.appendEvent({
      eventId: "evt-pg-replay-002",
      sessionId: "whatsapp:5215512345678",
      timestamp: "2026-05-06T03:00:01.000Z",
      type: "message_processed",
      payload: {
        channel: "whatsapp",
        customerId: "5215512345678",
        channelMessageId: "wamid.pg.replay.001",
        duplicate: false,
        deliveryStatus: "skipped",
        responseId: "consult-coverage-resolved",
        resolvedIntentId: "consult-coverage",
        stage: "resolve-coverage",
        status: "resolved",
        humanInterventionRequired: false,
      },
    });

    const replay = await replaySession(journal, "whatsapp:5215512345678");

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
        lastEventId: "evt-pg-replay-002",
        lastEventType: "message_processed",
        lastSequence: 2,
      },
    });

    if (!replay.ok) {
      throw new Error("Expected replay to succeed");
    }

    expect(replay.replayHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns empty intact journals for sessions without events", async () => {
    const fake = new FakePostgresJournalPool();
    const journal = createPostgresExecutionJournal({ pool: asPool(fake) });

    await expect(journal.verifyChain("missing-session")).resolves.toBe(true);

    await expect(
      journal.getSessionJournal("missing-session", { integrityCheck: true }),
    ).resolves.toEqual({
      sessionId: "missing-session",
      events: [],
      integrityOk: true,
    });
  });
});