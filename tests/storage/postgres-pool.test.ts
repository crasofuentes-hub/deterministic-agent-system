import { describe, expect, it } from "vitest";
import {
  buildPostgresPoolOptionsForTests,
  createPostgresPool,
  type PostgresPoolConstructorOptions,
  type PostgresPoolLike,
} from "../../src/storage/postgres-pool";
import type { PostgresPoolConfig } from "../../src/storage/postgres-config";

function createConfig(): PostgresPoolConfig {
  return {
    connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
    maxConnections: 12,
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 7000,
    statementTimeoutMillis: 25000,
  };
}

describe("postgres pool wrapper", () => {
  it("maps deterministic config into pg pool options", () => {
    expect(buildPostgresPoolOptionsForTests(createConfig())).toEqual({
      connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      max: 12,
      idleTimeoutMillis: 45000,
      connectionTimeoutMillis: 7000,
      statement_timeout: 25000,
    });
  });

  it("creates a pool through an injected factory without opening a real connection", async () => {
    const createdOptions: PostgresPoolConstructorOptions[] = [];
    const queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
    let closed = false;

    const fakePool: PostgresPoolLike = {
      async query<Row>(sql: string, values?: readonly unknown[]) {
        queries.push({ sql, values });
        return {
          rows: [{ ok: true }] as Row[],
          rowCount: 1,
        };
      },
      async end() {
        closed = true;
      },
    };

    const pool = createPostgresPool({
      config: createConfig(),
      createPool(options) {
        createdOptions.push(options);
        return fakePool;
      },
    });

    await expect(pool.query<{ ok: boolean }>(" SELECT true AS ok ", ["value-001"])).resolves.toEqual({
      rows: [{ ok: true }],
      rowCount: 1,
    });

    await pool.close();

    expect(createdOptions).toEqual([
      {
        connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        max: 12,
        idleTimeoutMillis: 45000,
        connectionTimeoutMillis: 7000,
        statement_timeout: 25000,
      },
    ]);
    expect(queries).toEqual([
      {
        sql: "SELECT true AS ok",
        values: ["value-001"],
      },
    ]);
    expect(closed).toBe(true);
  });

  it("rejects empty SQL before delegating to the pool", async () => {
    let called = false;

    const fakePool: PostgresPoolLike = {
      async query<Row>() {
        called = true;
        return {
          rows: [] as Row[],
          rowCount: 0,
        };
      },
      async end() {},
    };

    const pool = createPostgresPool({
      config: createConfig(),
      createPool() {
        return fakePool;
      },
    });

    await expect(pool.query("   ")).rejects.toThrow("sql must be a non-empty string");
    expect(called).toBe(false);
  });
});