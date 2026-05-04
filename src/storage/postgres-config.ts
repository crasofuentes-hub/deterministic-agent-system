export interface PostgresPoolConfig {
  readonly connectionString: string;
  readonly maxConnections: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
  readonly statementTimeoutMillis: number;
}

export interface PostgresPoolConfigInput {
  readonly DATABASE_URL?: string;
  readonly POSTGRES_POOL_MAX?: string;
  readonly POSTGRES_IDLE_TIMEOUT_MS?: string;
  readonly POSTGRES_CONNECTION_TIMEOUT_MS?: string;
  readonly POSTGRES_STATEMENT_TIMEOUT_MS?: string;
}

const DEFAULT_MAX_CONNECTIONS = 10;
const DEFAULT_IDLE_TIMEOUT_MILLIS = 30000;
const DEFAULT_CONNECTION_TIMEOUT_MILLIS = 5000;
const DEFAULT_STATEMENT_TIMEOUT_MILLIS = 15000;

function readRequiredString(value: string | undefined, name: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function readPositiveInteger(value: string | undefined, name: string, fallback: number): number {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback;
  }

  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(name + " must be a positive integer");
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(name + " must be a positive integer");
  }

  return parsed;
}

export function parsePostgresPoolConfig(input: PostgresPoolConfigInput): PostgresPoolConfig {
  return {
    connectionString: readRequiredString(input.DATABASE_URL, "DATABASE_URL"),
    maxConnections: readPositiveInteger(input.POSTGRES_POOL_MAX, "POSTGRES_POOL_MAX", DEFAULT_MAX_CONNECTIONS),
    idleTimeoutMillis: readPositiveInteger(
      input.POSTGRES_IDLE_TIMEOUT_MS,
      "POSTGRES_IDLE_TIMEOUT_MS",
      DEFAULT_IDLE_TIMEOUT_MILLIS
    ),
    connectionTimeoutMillis: readPositiveInteger(
      input.POSTGRES_CONNECTION_TIMEOUT_MS,
      "POSTGRES_CONNECTION_TIMEOUT_MS",
      DEFAULT_CONNECTION_TIMEOUT_MILLIS
    ),
    statementTimeoutMillis: readPositiveInteger(
      input.POSTGRES_STATEMENT_TIMEOUT_MS,
      "POSTGRES_STATEMENT_TIMEOUT_MS",
      DEFAULT_STATEMENT_TIMEOUT_MILLIS
    ),
  };
}

export function parsePostgresPoolConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PostgresPoolConfig {
  return parsePostgresPoolConfig({
    DATABASE_URL: env.DATABASE_URL,
    POSTGRES_POOL_MAX: env.POSTGRES_POOL_MAX,
    POSTGRES_IDLE_TIMEOUT_MS: env.POSTGRES_IDLE_TIMEOUT_MS,
    POSTGRES_CONNECTION_TIMEOUT_MS: env.POSTGRES_CONNECTION_TIMEOUT_MS,
    POSTGRES_STATEMENT_TIMEOUT_MS: env.POSTGRES_STATEMENT_TIMEOUT_MS,
  });
}