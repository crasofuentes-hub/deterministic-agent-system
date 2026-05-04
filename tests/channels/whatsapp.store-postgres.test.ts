import { describe, expect, it } from "vitest";
import { createPostgresWhatsAppStore } from "../../src/channels/whatsapp/store-postgres";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";
import type {
  DeterministicPostgresPool,
  PostgresQueryResult,
} from "../../src/storage/postgres-pool";

function createConfig(): PostgresPoolConfig {
  return {
    connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeoutMillis: 15000,
  };
}

function createFakePool(): DeterministicPostgresPool & {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }>;
  readonly closed: () => boolean;
} {
  const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const sessions = new Map<string, unknown>();
  const processed = new Set<string>();
  const evidence = new Map<string, unknown>();
  const handoffs = new Map<string, unknown>();
  const events = new Map<string, unknown>();
  let closed = false;

  return {
    config: createConfig(),
    queries,
    closed: () => closed,

    async query<Row = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<PostgresQueryResult<Row>> {
      queries.push({ sql, values });

      if (sql.startsWith("SELECT session_json")) {
        const value = sessions.get(String(values?.[0]));
        return {
          rows: value ? ([{ session_json: value }] as Row[]) : [],
          rowCount: value ? 1 : 0,
        };
      }

      if (sql.startsWith("INSERT INTO whatsapp_sessions")) {
        sessions.set(String(values?.[0]), JSON.parse(String(values?.[1])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      if (sql.startsWith("SELECT channel_message_id")) {
        const key = String(values?.[0]);
        return {
          rows: processed.has(key) ? ([{ channel_message_id: key }] as Row[]) : [],
          rowCount: processed.has(key) ? 1 : 0,
        };
      }

      if (sql.startsWith("INSERT INTO whatsapp_processed_messages")) {
        processed.add(String(values?.[0]));
        return { rows: [] as Row[], rowCount: 1 };
      }

      if (sql.startsWith("SELECT evidence_json")) {
        const value = evidence.get(String(values?.[0]));
        return {
          rows: value ? ([{ evidence_json: value }] as Row[]) : [],
          rowCount: value ? 1 : 0,
        };
      }

      if (sql.startsWith("INSERT INTO whatsapp_conversation_evidence")) {
        evidence.set(String(values?.[0]), JSON.parse(String(values?.[1])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      if (sql.startsWith("SELECT handoff_json")) {
        return {
          rows: Array.from(handoffs.values()).map((handoff_json) => ({ handoff_json })) as Row[],
          rowCount: handoffs.size,
        };
      }

      if (sql.startsWith("INSERT INTO whatsapp_handoffs")) {
        handoffs.set(String(values?.[0]), JSON.parse(String(values?.[2])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      if (sql.startsWith("SELECT event_json")) {
        const customerId = String(values?.[0]);
        const rows = Array.from(events.values())
          .filter((event) => (event as { customerId: string }).customerId === customerId)
          .map((event_json) => ({ event_json })) as Row[];

        return {
          rows,
          rowCount: rows.length,
        };
      }

      if (sql.startsWith("INSERT INTO whatsapp_conversation_events")) {
        events.set(String(values?.[0]), JSON.parse(String(values?.[3])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      throw new Error("Unexpected SQL: " + sql);
    },

    async close(): Promise<void> {
      closed = true;
    },
  };
}

describe("postgres whatsapp store", () => {
  it("creates deterministic initial sessions when no postgres row exists", async () => {
    const pool = createFakePool();
    const store = createPostgresWhatsAppStore({
      pool,
      businessContextId: "customer-service-core-v2",
    });

    await expect(store.loadSession("5215512345678")).resolves.toEqual({
      sessionId: "whatsapp-session:5215512345678",
      businessContextId: "customer-service-core-v2",
      conversationStatus: "active",
      collectedEntities: [],
      missingEntityIds: [],
      handoffRequested: false,
      turns: [],
    });
  });

  it("persists sessions and processed messages through postgres queries", async () => {
    const pool = createFakePool();
    const store = createPostgresWhatsAppStore({
      pool,
      businessContextId: "customer-service-core-v2",
    });

    const session = await store.loadSession("5215512345678");
    const updated = {
      ...session,
      currentIntentId: "consult-coverage",
      currentStage: "resolve-coverage",
    };

    await store.saveSession("5215512345678", updated);
    await expect(store.loadSession("5215512345678")).resolves.toEqual(updated);

    await expect(store.hasProcessedMessage("wamid.postgres.001")).resolves.toBe(false);
    await store.markMessageProcessed("wamid.postgres.001");
    await expect(store.hasProcessedMessage("wamid.postgres.001")).resolves.toBe(true);
  });

  it("persists evidence, handoffs, and conversation events through postgres queries", async () => {
    const pool = createFakePool();
    const store = createPostgresWhatsAppStore({
      pool,
      businessContextId: "customer-service-core-v2",
    });

    await store.saveEvidence({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.coverage.001",
      lastResponseId: "consult-coverage-resolved",
      lastResolvedIntentId: "consult-coverage",
      lastStage: "resolve-coverage",
      lastStatus: "resolved",
      lastOutboundText: "Policy NMA-****-1001 for Maria Alvarez",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });

    await expect(store.loadEvidence("5215512345678")).resolves.toEqual({
      customerId: "5215512345678",
      lastInboundMessageId: "wamid.coverage.001",
      lastResponseId: "consult-coverage-resolved",
      lastResolvedIntentId: "consult-coverage",
      lastStage: "resolve-coverage",
      lastStatus: "resolved",
      lastOutboundText: "Policy NMA-****-1001 for Maria Alvarez",
      humanInterventionRequired: false,
      updatedAtIso: "2026-03-24T00:00:00.000Z",
    });

    await store.saveHandoff({
      handoffId: "handoff:5215512345678:wamid.handoff.001",
      customerId: "5215512345678",
      createdAtIso: "2026-03-24T00:00:00.000Z",
      updatedAtIso: "2026-03-24T00:00:00.000Z",
      handoffReasonCode: "explicit-human-request",
      handoffQueue: "licensed-broker",
      status: "open",
      lastInboundMessageId: "wamid.handoff.001",
      lastResponseId: "handoff-requested",
      lastResolvedIntentId: "request-human-handoff",
      lastStage: "handoff-requested",
      lastStatus: "handoff",
      lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
    });

    await expect(store.listHandoffs()).resolves.toEqual([
      {
        handoffId: "handoff:5215512345678:wamid.handoff.001",
        customerId: "5215512345678",
        createdAtIso: "2026-03-24T00:00:00.000Z",
        updatedAtIso: "2026-03-24T00:00:00.000Z",
        handoffReasonCode: "explicit-human-request",
        handoffQueue: "licensed-broker",
        status: "open",
        lastInboundMessageId: "wamid.handoff.001",
        lastResponseId: "handoff-requested",
        lastResolvedIntentId: "request-human-handoff",
        lastStage: "handoff-requested",
        lastStatus: "handoff",
        lastOutboundText: "Your conversation will be transferred to a licensed broker specialist.",
      },
    ]);

    await store.saveConversationEvent({
      eventId: "event:5215512345678:001",
      customerId: "5215512345678",
      occurredAtIso: "2026-03-24T00:00:00.000Z",
      kind: "inbound",
      channelMessageId: "wamid.coverage.001",
      text: "Coverage details for POL-AUTO-1001",
    });

    await expect(store.listConversationEvents("5215512345678")).resolves.toEqual([
      {
        eventId: "event:5215512345678:001",
        customerId: "5215512345678",
        occurredAtIso: "2026-03-24T00:00:00.000Z",
        kind: "inbound",
        channelMessageId: "wamid.coverage.001",
        text: "Coverage details for POL-AUTO-1001",
      },
    ]);
  });

  it("closes the underlying deterministic postgres pool", async () => {
    const pool = createFakePool();
    const store = createPostgresWhatsAppStore({
      pool,
      businessContextId: "customer-service-core-v2",
    });

    await store.close();

    expect(pool.closed()).toBe(true);
  });
});