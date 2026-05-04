import { Pool } from "pg";
import type { PostgresPoolConfig } from "./postgres-config";

export interface PostgresQueryResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface PostgresPoolLike {
  query<Row = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<PostgresQueryResult<Row>>;
  end(): Promise<void>;
}

export interface PostgresPoolConstructorOptions {
  readonly connectionString: string;
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
  readonly statement_timeout: number;
}

export interface CreatePostgresPoolOptions {
  readonly config: PostgresPoolConfig;
  readonly createPool?: (options: PostgresPoolConstructorOptions) => PostgresPoolLike;
}

export interface DeterministicPostgresPool {
  readonly config: PostgresPoolConfig;
  query<Row = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<PostgresQueryResult<Row>>;
  close(): Promise<void>;
}

function buildPoolOptions(config: PostgresPoolConfig): PostgresPoolConstructorOptions {
  return {
    connectionString: config.connectionString,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    statement_timeout: config.statementTimeoutMillis,
  };
}

function createDefaultPool(options: PostgresPoolConstructorOptions): PostgresPoolLike {
  return new Pool(options);
}

function normalizeSql(sql: string): string {
  const normalized = sql.trim();

  if (!normalized) {
    throw new Error("sql must be a non-empty string");
  }

  return normalized;
}

export function createPostgresPool(options: CreatePostgresPoolOptions): DeterministicPostgresPool {
  const poolOptions = buildPoolOptions(options.config);
  const pool = (options.createPool ?? createDefaultPool)(poolOptions);

  return {
    config: {
      ...options.config,
    },

    async query<Row = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<PostgresQueryResult<Row>> {
      return pool.query<Row>(normalizeSql(sql), values ? [...values] : undefined);
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}

export function buildPostgresPoolOptionsForTests(
  config: PostgresPoolConfig
): PostgresPoolConstructorOptions {
  return buildPoolOptions(config);
}