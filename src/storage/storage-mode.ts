export type StorageMode = "auto" | "memory" | "sqlite" | "postgres";

export interface StorageModeEnvironment {
  readonly NODE_ENV?: string;
  readonly STORAGE_MODE?: string;
  readonly DATABASE_URL?: string;
  readonly SQLITE_PATH?: string;
}

export interface ResolveStorageModeInput {
  readonly requestedMode?: string;
  readonly env?: StorageModeEnvironment;
  readonly defaultSqlitePath?: string;
}

export interface ResolvedMemoryStorageMode {
  readonly ok: true;
  readonly mode: "memory";
  readonly productionRecommended: false;
  readonly reason: string;
}

export interface ResolvedSqliteStorageMode {
  readonly ok: true;
  readonly mode: "sqlite";
  readonly sqlitePath: string;
  readonly productionRecommended: false;
  readonly reason: string;
}

export interface ResolvedPostgresStorageMode {
  readonly ok: true;
  readonly mode: "postgres";
  readonly databaseUrl: string;
  readonly productionRecommended: true;
  readonly reason: string;
}

export type ResolvedStorageMode =
  | ResolvedMemoryStorageMode
  | ResolvedSqliteStorageMode
  | ResolvedPostgresStorageMode;

export interface StorageModeResolutionError {
  readonly ok: false;
  readonly code:
    | "INVALID_STORAGE_MODE"
    | "POSTGRES_DATABASE_URL_REQUIRED"
    | "PRODUCTION_POSTGRES_REQUIRED";
  readonly message: string;
  readonly requestedMode: string;
  readonly production: boolean;
  readonly allowedModes: readonly StorageMode[];
}

export type StorageModeResolution = ResolvedStorageMode | StorageModeResolutionError;

export const STORAGE_MODES: readonly StorageMode[] = ["auto", "memory", "sqlite", "postgres"];

export const DEFAULT_SQLITE_PATH = ".data/deterministic-agent-system.sqlite";

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function isStorageMode(value: string): value is StorageMode {
  return STORAGE_MODES.includes(value as StorageMode);
}

export function parseStorageMode(value: string | undefined): StorageMode {
  const normalized = normalizeString(value);

  if (typeof normalized === "undefined") {
    return "auto";
  }

  const lower = normalized.toLowerCase();

  if (!isStorageMode(lower)) {
    throw new Error(
      "Invalid storage mode: " +
        normalized +
        ". Allowed modes: " +
        STORAGE_MODES.join(", "),
    );
  }

  return lower;
}

export function isProductionEnvironment(env: StorageModeEnvironment | undefined): boolean {
  return normalizeString(env?.NODE_ENV)?.toLowerCase() === "production";
}

function invalidStorageMode(
  requestedMode: string,
  production: boolean,
): StorageModeResolutionError {
  return {
    ok: false,
    code: "INVALID_STORAGE_MODE",
    message:
      "Invalid storage mode: " +
      requestedMode +
      ". Allowed modes: " +
      STORAGE_MODES.join(", "),
    requestedMode,
    production,
    allowedModes: STORAGE_MODES,
  };
}

function postgresDatabaseUrlRequired(
  requestedMode: string,
  production: boolean,
): StorageModeResolutionError {
  return {
    ok: false,
    code: "POSTGRES_DATABASE_URL_REQUIRED",
    message:
      "storage mode postgres requires DATABASE_URL or an explicit postgres connection URL.",
    requestedMode,
    production,
    allowedModes: STORAGE_MODES,
  };
}

function productionPostgresRequired(requestedMode: string): StorageModeResolutionError {
  return {
    ok: false,
    code: "PRODUCTION_POSTGRES_REQUIRED",
    message:
      "storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production.",
    requestedMode,
    production: true,
    allowedModes: STORAGE_MODES,
  };
}

export function resolveStorageMode(input: ResolveStorageModeInput = {}): StorageModeResolution {
  const env = input.env ?? {};
  const production = isProductionEnvironment(env);
  const rawRequestedMode =
    normalizeString(input.requestedMode) ??
    normalizeString(env.STORAGE_MODE) ??
    "auto";
  const normalizedRequestedMode = rawRequestedMode.toLowerCase();

  if (!isStorageMode(normalizedRequestedMode)) {
    return invalidStorageMode(rawRequestedMode, production);
  }

  const requestedMode = normalizedRequestedMode;
  const databaseUrl = normalizeString(env.DATABASE_URL);
  const sqlitePath =
    normalizeString(env.SQLITE_PATH) ??
    normalizeString(input.defaultSqlitePath) ??
    DEFAULT_SQLITE_PATH;

  if (requestedMode === "memory") {
    return {
      ok: true,
      mode: "memory",
      productionRecommended: false,
      reason: "memory storage is intended for tests and ephemeral local runs.",
    };
  }

  if (requestedMode === "sqlite") {
    return {
      ok: true,
      mode: "sqlite",
      sqlitePath,
      productionRecommended: false,
      reason: "sqlite storage is intended for local development and zero-config usage.",
    };
  }

  if (requestedMode === "postgres") {
    if (typeof databaseUrl === "undefined") {
      return postgresDatabaseUrlRequired(requestedMode, production);
    }

    return {
      ok: true,
      mode: "postgres",
      databaseUrl,
      productionRecommended: true,
      reason: "postgres storage is recommended for production and live pilots.",
    };
  }

  if (production) {
    if (typeof databaseUrl === "undefined") {
      return productionPostgresRequired(requestedMode);
    }

    return {
      ok: true,
      mode: "postgres",
      databaseUrl,
      productionRecommended: true,
      reason:
        "auto storage detected production and selected postgres because DATABASE_URL is configured.",
    };
  }

  return {
    ok: true,
    mode: "sqlite",
    sqlitePath,
    productionRecommended: false,
    reason: "auto storage selected sqlite for local zero-config usage.",
  };
}

export function assertResolvedStorageMode(input: ResolveStorageModeInput = {}): ResolvedStorageMode {
  const resolved = resolveStorageMode(input);

  if (!resolved.ok) {
    throw new Error(resolved.code + ": " + resolved.message);
  }

  return resolved;
}