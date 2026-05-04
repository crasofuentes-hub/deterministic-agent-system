import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createAsyncWhatsAppStore,
  createWhatsAppStore,
  parseWhatsAppStoreBackend,
} from "../../src/channels/whatsapp/store-factory";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";
import type {
  DeterministicPostgresPool,
  PostgresQueryResult,
} from "../../src/storage/postgres-pool";

function createTempDbPath(name: string): string {
  return join(tmpdir(), "det-agent-" + name + "-" + process.pid + "-" + Date.now() + ".sqlite");
}

describe("whatsapp store factory", () => {
  it("defaults to the in-memory backend deterministically", () => {
    expect(parseWhatsAppStoreBackend(undefined)).toBe("memory");
    expect(parseWhatsAppStoreBackend(" memory ")).toBe("memory");
    expect(parseWhatsAppStoreBackend("SQLITE")).toBe("sqlite");
    expect(parseWhatsAppStoreBackend("postgres")).toBe("postgres");
  });

  it("rejects unsupported backends deterministically", () => {
    expect(() => parseWhatsAppStoreBackend("redis")).toThrow(
      "WHATSAPP_STORE_BACKEND must be one of: memory, sqlite, postgres"
    );
  });

  it("creates an in-memory whatsapp store", () => {
    const created = createWhatsAppStore({
      backend: "memory",
      businessContextId: "customer-service-core-v2",
    });

    try {
      expect(created.backend).toBe("memory");
      expect(created.store.loadSession("5215512345678").sessionId).toBe(
        "whatsapp-session:5215512345678"
      );
    } finally {
      created.close();
    }
  });

  it("creates a sqlite whatsapp store through the common factory", () => {
    const dbPath = createTempDbPath("whatsapp-store-factory");

    try {
      const created = createWhatsAppStore({
        backend: "sqlite",
        businessContextId: "customer-service-core-v2",
        sqliteDbPath: dbPath,
      });

      try {
        const session = created.store.loadSession("5215512345678");
        const updated = {
          ...session,
          currentIntentId: "consult-coverage",
          currentStage: "resolve-coverage",
        };

        created.store.saveSession("5215512345678", updated);
        expect(created.store.loadSession("5215512345678")).toEqual(updated);
      } finally {
        created.close();
      }
    } finally {
      if (existsSync(dbPath)) {
        rmSync(dbPath, { force: true });
      }
    }
  });

  it("requires a sqlite database path for sqlite backend", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "sqlite",
        businessContextId: "customer-service-core-v2",
      })
    ).toThrow("sqliteDbPath must be a non-empty string");
  });

  it("keeps postgres backend explicit until the adapter is implemented", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "postgres",
        businessContextId: "customer-service-core-v2",
        postgres: {
          DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        },
      })
    ).toThrow("postgres whatsapp store is not implemented yet");
  });

  it("validates postgres config before reporting adapter availability", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "postgres",
        businessContextId: "customer-service-core-v2",
      })
    ).toThrow("DATABASE_URL must be a non-empty string");
  });

  it("creates an async in-memory whatsapp store through the common factory", async () => {
    const created = await createAsyncWhatsAppStore({
      backend: "memory",
      businessContextId: "customer-service-core-v2",
    });

    try {
      await expect(created.store.loadSession("5215512345678")).resolves.toEqual({
        sessionId: "whatsapp-session:5215512345678",
        businessContextId: "customer-service-core-v2",
        conversationStatus: "active",
        collectedEntities: [],
        missingEntityIds: [],
        handoffRequested: false,
        turns: [],
      });
    } finally {
      await created.close();
    }
  });

  it("creates an async sqlite whatsapp store through the common factory", async () => {
    const dbPath = createTempDbPath("whatsapp-async-store-factory");

    try {
      const created = await createAsyncWhatsAppStore({
        backend: "sqlite",
        businessContextId: "customer-service-core-v2",
        sqliteDbPath: dbPath,
      });

      try {
        const session = await created.store.loadSession("5215512345678");
        const updated = {
          ...session,
          currentIntentId: "consult-coverage",
          currentStage: "resolve-coverage",
        };

        await created.store.saveSession("5215512345678", updated);
        await expect(created.store.loadSession("5215512345678")).resolves.toEqual(updated);
      } finally {
        await created.close();
      }
    } finally {
      if (existsSync(dbPath)) {
        rmSync(dbPath, { force: true });
      }
    }
  });

  it("creates an async postgres whatsapp store through the common factory", async () => {
    const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
    const configs: PostgresPoolConfig[] = [];
    const sessions = new Map<string, unknown>();
    let closed = false;

    const fakePool: DeterministicPostgresPool = {
      config: {
        connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        maxConnections: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statementTimeoutMillis: 15000,
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

    const created = await createAsyncWhatsAppStore({
      backend: "postgres",
      businessContextId: "customer-service-core-v2",
      postgres: {
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      },
      migrationAppliedAtIso: "2026-03-24T00:00:00.000Z",
      createPool(config) {
        configs.push(config);
        return fakePool;
      },
    });

    try {
      expect(created.backend).toBe("postgres");

      const session = await created.store.loadSession("5215512345678");
      const updated = {
        ...session,
        currentIntentId: "consult-coverage",
        currentStage: "resolve-coverage",
      };

      await created.store.saveSession("5215512345678", updated);
      await expect(created.store.loadSession("5215512345678")).resolves.toEqual(updated);
    } finally {
      await created.close();
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
    expect(queries[0].sql).toContain("CREATE TABLE IF NOT EXISTS det_agent_schema_migrations");
    expect(queries[1]).toEqual({
      sql:
        "INSERT INTO det_agent_schema_migrations (id, applied_at_iso)\n" +
        "VALUES ($1, $2)\n" +
        "ON CONFLICT (id) DO NOTHING",
      values: ["0001_whatsapp_store_foundation", "2026-03-24T00:00:00.000Z"],
    });
    expect(closed).toBe(true);
  });

  it("rejects async postgres store creation when config is missing", async () => {
    await expect(
      createAsyncWhatsAppStore({
        backend: "postgres",
        businessContextId: "customer-service-core-v2",
      })
    ).rejects.toThrow("DATABASE_URL must be a non-empty string");
  });
});