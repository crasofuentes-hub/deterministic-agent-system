import { describe, expect, it } from "vitest";
import {
  applyPostgresMigrations,
  listPostgresMigrations,
} from "../../src/storage/postgres-migrations";
import type { DeterministicPostgresPool, PostgresQueryResult } from "../../src/storage/postgres-pool";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";

function createConfig(): PostgresPoolConfig {
  return {
    connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeoutMillis: 15000,
  };
}

describe("postgres migrations", () => {
  it("lists deterministic whatsapp store migrations in order", () => {
    expect(listPostgresMigrations().map((migration) => migration.id)).toEqual([
      "0001_whatsapp_store_foundation",
    ]);

    expect(listPostgresMigrations()[0].sql).toContain(
      "CREATE TABLE IF NOT EXISTS whatsapp_sessions"
    );
    expect(listPostgresMigrations()[0].sql).toContain(
      "CREATE TABLE IF NOT EXISTS whatsapp_processed_messages"
    );
    expect(listPostgresMigrations()[0].sql).toContain(
      "CREATE TABLE IF NOT EXISTS whatsapp_conversation_evidence"
    );
    expect(listPostgresMigrations()[0].sql).toContain(
      "CREATE TABLE IF NOT EXISTS whatsapp_handoffs"
    );
    expect(listPostgresMigrations()[0].sql).toContain(
      "CREATE TABLE IF NOT EXISTS whatsapp_conversation_events"
    );
  });

  it("applies migrations using deterministic SQL and records migration ids", async () => {
    const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];

    const pool: DeterministicPostgresPool = {
      config: createConfig(),
      async query<Row = Record<string, unknown>>(
        sql: string,
        values?: readonly unknown[]
      ): Promise<PostgresQueryResult<Row>> {
        queries.push({ sql, values });
        return {
          rows: [] as Row[],
          rowCount: 0,
        };
      },
      async close(): Promise<void> {},
    };

    await applyPostgresMigrations(pool, "2026-03-24T00:00:00.000Z");

    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain("CREATE TABLE IF NOT EXISTS det_agent_schema_migrations");
    expect(queries[0].sql).toContain("CREATE INDEX IF NOT EXISTS idx_whatsapp_handoffs_created");
    expect(queries[0].values).toBeUndefined();

    expect(queries[1]).toEqual({
      sql:
        "INSERT INTO det_agent_schema_migrations (id, applied_at_iso)\n" +
        "VALUES ($1, $2)\n" +
        "ON CONFLICT (id) DO NOTHING",
      values: ["0001_whatsapp_store_foundation", "2026-03-24T00:00:00.000Z"],
    });
  });

  it("rejects empty migration timestamps", async () => {
    const pool: DeterministicPostgresPool = {
      config: createConfig(),
      async query<Row = Record<string, unknown>>(): Promise<PostgresQueryResult<Row>> {
        return {
          rows: [] as Row[],
          rowCount: 0,
        };
      },
      async close(): Promise<void> {},
    };

    await expect(applyPostgresMigrations(pool, "   ")).rejects.toThrow(
      "appliedAtIso must be a non-empty string"
    );
  });
});