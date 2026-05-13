import {
  assertResolvedStorageMode,
  resolveStorageMode,
  type ResolvedStorageMode,
  type StorageModeEnvironment,
  type StorageModeResolution,
} from "./storage-mode";

export interface RuntimeStorageModeInput {
  readonly env?: Record<string, string | undefined>;
  readonly requestedMode?: string;
  readonly defaultSqlitePath?: string;
}

export function readRuntimeStorageModeEnvironment(
  env: Record<string, string | undefined>,
): StorageModeEnvironment {
  return {
    NODE_ENV: env.NODE_ENV,
    STORAGE_MODE: env.STORAGE_MODE,
    DATABASE_URL: env.DATABASE_URL,
    SQLITE_PATH: env.SQLITE_PATH,
  };
}

export function resolveRuntimeStorageMode(
  input: RuntimeStorageModeInput = {},
): StorageModeResolution {
  return resolveStorageMode({
    requestedMode: input.requestedMode,
    env: readRuntimeStorageModeEnvironment(input.env ?? process.env),
    defaultSqlitePath: input.defaultSqlitePath,
  });
}

export function assertRuntimeStorageMode(
  input: RuntimeStorageModeInput = {},
): ResolvedStorageMode {
  return assertResolvedStorageMode({
    requestedMode: input.requestedMode,
    env: readRuntimeStorageModeEnvironment(input.env ?? process.env),
    defaultSqlitePath: input.defaultSqlitePath,
  });
}

export function formatStorageModeStartupMessage(resolution: StorageModeResolution): string {
  if (!resolution.ok) {
    return [
      "storage.mode.error",
      "code=" + resolution.code,
      "requestedMode=" + resolution.requestedMode,
      "production=" + String(resolution.production),
      "message=" + JSON.stringify(resolution.message),
    ].join(" ");
  }

  if (resolution.mode === "postgres") {
    return [
      "storage.mode",
      "mode=postgres",
      "productionRecommended=true",
      "reason=" + JSON.stringify(resolution.reason),
    ].join(" ");
  }

  if (resolution.mode === "sqlite") {
    return [
      "storage.mode",
      "mode=sqlite",
      "sqlitePath=" + JSON.stringify(resolution.sqlitePath),
      "productionRecommended=false",
      "reason=" + JSON.stringify(resolution.reason),
    ].join(" ");
  }

  return [
    "storage.mode",
    "mode=memory",
    "productionRecommended=false",
    "reason=" + JSON.stringify(resolution.reason),
  ].join(" ");
}