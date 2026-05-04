import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAsyncWhatsAppRuntime } from "../../src/channels/whatsapp/runtime-async";
import { buildWhatsAppTextOutbound } from "../../src/channels/whatsapp/send";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";
import type {
  DeterministicPostgresPool,
  PostgresQueryResult,
} from "../../src/storage/postgres-pool";

function createTempDbPath(testName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dass-whatsapp-runtime-async-"));
  return path.join(dir, testName + ".sqlite");
}

function createFakePostgresPool(): DeterministicPostgresPool & {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }>;
  readonly closed: () => boolean;
} {
  const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const sessions = new Map<string, unknown>();
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

      throw new Error("Unexpected SQL: " + sql);
    },

    async close(): Promise<void> {
      closed = true;
    },
  };
}

describe("async whatsapp runtime", () => {
  it("resolves skipped mode with async memory store by default", async () => {
    const runtime = await resolveAsyncWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
      },
    });

    try {
      expect(runtime.verifyToken).toBe("verify-token-001");
      expect(runtime.deliveryMode).toBe("skipped");
      expect(runtime.sender).toBeUndefined();

      await expect(runtime.store.loadSession("5215512345678")).resolves.toEqual({
        sessionId: "whatsapp-session:5215512345678",
        businessContextId: "customer-service-core-v2",
        conversationStatus: "active",
        collectedEntities: [],
        missingEntityIds: [],
        handoffRequested: false,
        turns: [],
      });
    } finally {
      await runtime.close();
    }
  });

  it("resolves mock mode with async store and sender", async () => {
    const runtime = await resolveAsyncWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_DELIVERY_MODE: "mock",
      },
    });

    try {
      expect(runtime.deliveryMode).toBe("mock");
      expect(runtime.sender).toBeDefined();

      const result = await runtime.sender!.send(
        buildWhatsAppTextOutbound({
          to: "5215512345678",
          body: "Hola desde mock async",
        })
      );

      expect(result).toEqual({
        ok: true,
        mode: "mock",
        providerMessageId: "mocked-whatsapp-message-001",
        acceptedAtIso: "2026-03-24T00:00:00.000Z",
      });
    } finally {
      await runtime.close();
    }
  });

  it("resolves sqlite store mode with async adapter", async () => {
    const dbPath = createTempDbPath("runtime-async-sqlite");

    try {
      const runtime = await resolveAsyncWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_STORE_MODE: "sqlite",
          WHATSAPP_SQLITE_PATH: dbPath,
        },
      });

      try {
        const session = await runtime.store.loadSession("5215512345678");
        expect(session.sessionId).toBe("whatsapp-session:5215512345678");

        await runtime.store.markMessageProcessed("wamid.runtime.async.sqlite.001");
        await expect(
          runtime.store.hasProcessedMessage("wamid.runtime.async.sqlite.001")
        ).resolves.toBe(true);
      } finally {
        await runtime.close();
      }
    } finally {
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { force: true });
      }
    }
  });

  it("resolves postgres store mode through injected deterministic pool", async () => {
    const fakePool = createFakePostgresPool();
    const configs: PostgresPoolConfig[] = [];

    const runtime = await resolveAsyncWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_STORE_MODE: "postgres",
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_MIGRATION_APPLIED_AT_ISO: "2026-03-24T00:00:00.000Z",
      },
      createPostgresPool(config) {
        configs.push(config);
        return fakePool;
      },
    });

    try {
      const session = await runtime.store.loadSession("5215512345678");
      const updated = {
        ...session,
        currentIntentId: "consult-coverage",
        currentStage: "resolve-coverage",
      };

      await runtime.store.saveSession("5215512345678", updated);
      await expect(runtime.store.loadSession("5215512345678")).resolves.toEqual(updated);
    } finally {
      await runtime.close();
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

  it("rejects invalid store mode", async () => {
    await expect(
      resolveAsyncWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_STORE_MODE: "banana",
        },
      })
    ).rejects.toThrow("WHATSAPP_STORE_MODE must be one of: memory, sqlite, postgres");
  });

  it("rejects incomplete postgres configuration", async () => {
    await expect(
      resolveAsyncWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_STORE_MODE: "postgres",
        },
      })
    ).rejects.toThrow("DATABASE_URL must be a non-empty string");
  });

  it("rejects incomplete http configuration and closes the async store", async () => {
    await expect(
      resolveAsyncWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "http",
          WHATSAPP_API_VERSION: "v23.0",
        },
      })
    ).rejects.toThrow("WHATSAPP_PHONE_NUMBER_ID is required for http mode");
  });
});