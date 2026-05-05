import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../../src/http/server";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";
import type {
  DeterministicPostgresPool,
  PostgresQueryResult,
} from "../../src/storage/postgres-pool";

const ENV_KEYS = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_RUNTIME_MODE",
  "WHATSAPP_STORE_MODE",
  "WHATSAPP_DELIVERY_MODE",
  "DATABASE_URL",
  "POSTGRES_MIGRATION_APPLIED_AT_ISO",
] as const;

const originalEnv = new Map<string, string | undefined>();

for (const key of ENV_KEYS) {
  originalEnv.set(key, process.env[key]);
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function buildInboundBody(messageId: string, userText: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-001",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "phone-number-id-001",
              },
              contacts: [
                {
                  profile: {
                    name: "Oscar Cliente",
                  },
                  wa_id: "5215512345678",
                },
              ],
              messages: [
                {
                  from: "5215512345678",
                  id: messageId,
                  timestamp: "1774310400",
                  text: {
                    body: userText,
                  },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function createFakePostgresPool(): DeterministicPostgresPool & {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }>;
  readonly closed: () => boolean;
  readonly evidenceFor: (customerId: string) => unknown;
} {
  const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const sessions = new Map<string, unknown>();
  const processed = new Set<string>();
  const evidence = new Map<string, unknown>();
  const events = new Map<string, unknown>();
  let closed = false;

  return {
    config: {
      connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statementTimeoutMillis: 15000,
    },

    queries,

    closed: () => closed,

    evidenceFor(customerId: string): unknown {
      return evidence.get(customerId);
    },

    async query<Row = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<PostgresQueryResult<Row>> {
      queries.push({ sql, values });

      if (sql.startsWith("CREATE TABLE IF NOT EXISTS det_agent_schema_migrations")) {
        return { rows: [] as Row[], rowCount: 0 };
      }

      if (sql.startsWith("INSERT INTO det_agent_schema_migrations")) {
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

      if (sql.startsWith("INSERT INTO whatsapp_conversation_events")) {
        events.set(String(values?.[0]), JSON.parse(String(values?.[3])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      if (sql.startsWith("INSERT INTO whatsapp_conversation_evidence")) {
        evidence.set(String(values?.[0]), JSON.parse(String(values?.[1])));
        return { rows: [] as Row[], rowCount: 1 };
      }

      throw new Error("Unexpected SQL: " + sql);
    },

    async close(): Promise<void> {
      closed = true;
    },
  };
}
describe("server async whatsapp runtime", () => {
  it("uses async whatsapp runtime when WHATSAPP_RUNTIME_MODE is async", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "async";
    process.env.WHATSAPP_STORE_MODE = "memory";
    process.env.WHATSAPP_DELIVERY_MODE = "skipped";

    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
    });

    try {
      const verifyResponse = await fetch(
        "http://" +
          server.host +
          ":" +
          server.port +
          "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=async-server-ok"
      );

      expect(verifyResponse.status).toBe(200);
      await expect(verifyResponse.text()).resolves.toBe("async-server-ok");

      const webhookResponse = await fetch(
        "http://" + server.host + ":" + server.port + "/webhooks/whatsapp",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-server-async-coverage-001",
          },
          body: buildInboundBody(
            "wamid.server.async.coverage.001",
            "Coverage details for POL-AUTO-1001"
          ),
        }
      );

      expect(webhookResponse.status).toBe(200);

      const json = await webhookResponse.json();

      expect(json.ok).toBe(true);
      expect(json.messagesReceived).toBe(1);
      expect(json.results[0].duplicate).toBe(false);
      expect(json.results[0].agent).toEqual(
        expect.objectContaining({
          responseId: "consult-coverage-resolved",
          resolvedIntentId: "consult-coverage",
          stage: "resolve-coverage",
          status: "resolved",
          humanInterventionRequired: false,
        })
      );
    } finally {
      await server.close();
    }
  });

  it("uses async postgres runtime with injected deterministic pool", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "async";
    process.env.WHATSAPP_STORE_MODE = "postgres";
    process.env.WHATSAPP_DELIVERY_MODE = "skipped";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/deterministic_agent_system";
    process.env.POSTGRES_MIGRATION_APPLIED_AT_ISO = "2026-03-24T00:00:00.000Z";

    const fakePool = createFakePostgresPool();
    const configs: PostgresPoolConfig[] = [];

    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
      createPostgresPool(config) {
        configs.push(config);
        return fakePool;
      },
    });

    try {
      const webhookResponse = await fetch(
        "http://" + server.host + ":" + server.port + "/webhooks/whatsapp",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-server-async-postgres-coverage-001",
          },
          body: buildInboundBody(
            "wamid.server.async.postgres.coverage.001",
            "Coverage details for POL-AUTO-1001"
          ),
        }
      );

      expect(webhookResponse.status).toBe(200);

      const json = await webhookResponse.json();

      expect(json.ok).toBe(true);
      expect(json.messagesReceived).toBe(1);
      expect(json.results[0].duplicate).toBe(false);
      expect(json.results[0].agent).toEqual(
        expect.objectContaining({
          responseId: "consult-coverage-resolved",
          resolvedIntentId: "consult-coverage",
          stage: "resolve-coverage",
          status: "resolved",
          humanInterventionRequired: false,
        })
      );

      expect(fakePool.evidenceFor("5215512345678")).toEqual(
        expect.objectContaining({
          customerId: "5215512345678",
          lastInboundMessageId: "wamid.server.async.postgres.coverage.001",
          lastResponseId: "consult-coverage-resolved",
          lastResolvedIntentId: "consult-coverage",
          lastStage: "resolve-coverage",
          lastStatus: "resolved",
          humanInterventionRequired: false,
        })
      );
    } finally {
      await server.close();
    }

    expect(configs).toEqual([
      {
        connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        maxConnections: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statementTimeoutMillis: 15000,
      },
    ]);
    expect(fakePool.queries[0].sql).toContain("CREATE TABLE IF NOT EXISTS det_agent_schema_migrations");
    expect(fakePool.closed()).toBe(true);
  });
  it("rejects async postgres runtime when database url is missing", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "async";
    process.env.WHATSAPP_STORE_MODE = "postgres";
    delete process.env.DATABASE_URL;

    await expect(
      startServer({
        port: 0,
        host: "127.0.0.1",
      })
    ).rejects.toThrow("DATABASE_URL must be a non-empty string");
  });
  it("rejects invalid whatsapp runtime mode during startup", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "banana";

    await expect(
      startServer({
        port: 0,
        host: "127.0.0.1",
      })
    ).rejects.toThrow("WHATSAPP_RUNTIME_MODE must be one of: sync, async");
  });
});