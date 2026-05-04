import { describe, expect, it } from "vitest";
import { parsePostgresPoolConfig, parsePostgresPoolConfigFromEnv } from "../../src/storage/postgres-config";

describe("postgres pool config", () => {
  it("parses deterministic defaults from a database url", () => {
    expect(
      parsePostgresPoolConfig({
        DATABASE_URL: " postgres://user:pass@localhost:5432/deterministic_agent_system ",
      })
    ).toEqual({
      connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statementTimeoutMillis: 15000,
    });
  });

  it("parses explicit positive integer pool settings", () => {
    expect(
      parsePostgresPoolConfig({
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_POOL_MAX: "20",
        POSTGRES_IDLE_TIMEOUT_MS: "45000",
        POSTGRES_CONNECTION_TIMEOUT_MS: "7000",
        POSTGRES_STATEMENT_TIMEOUT_MS: "25000",
      })
    ).toEqual({
      connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      maxConnections: 20,
      idleTimeoutMillis: 45000,
      connectionTimeoutMillis: 7000,
      statementTimeoutMillis: 25000,
    });
  });

  it("rejects a missing database url", () => {
    expect(() => parsePostgresPoolConfig({})).toThrow("DATABASE_URL must be a non-empty string");
  });

  it("rejects invalid pool integers deterministically", () => {
    expect(() =>
      parsePostgresPoolConfig({
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_POOL_MAX: "0",
      })
    ).toThrow("POSTGRES_POOL_MAX must be a positive integer");

    expect(() =>
      parsePostgresPoolConfig({
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_IDLE_TIMEOUT_MS: "10.5",
      })
    ).toThrow("POSTGRES_IDLE_TIMEOUT_MS must be a positive integer");
  });

  it("parses config from an explicit env object without reading ambient state", () => {
    expect(
      parsePostgresPoolConfigFromEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        POSTGRES_POOL_MAX: "12",
      })
    ).toEqual({
      connectionString: "postgres://user:pass@localhost:5432/deterministic_agent_system",
      maxConnections: 12,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statementTimeoutMillis: 15000,
    });
  });
});