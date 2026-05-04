import {
  parsePostgresPoolConfig,
  type PostgresPoolConfig,
  type PostgresPoolConfigInput,
} from "../../storage/postgres-config";
import { applyPostgresMigrations } from "../../storage/postgres-migrations";
import {
  createPostgresPool,
  type DeterministicPostgresPool,
} from "../../storage/postgres-pool";
import {
  createInMemoryWhatsAppStore,
  type InMemoryWhatsAppStoreOptions,
  type WhatsAppStore,
} from "./store";
import {
  adaptSyncWhatsAppStoreToAsync,
  type AsyncWhatsAppStore,
} from "./store-async";
import { createPostgresWhatsAppStore } from "./store-postgres";
import { createSqliteWhatsAppStore, type SqliteWhatsAppStore } from "./store-sqlite";

export type WhatsAppStoreBackend = "memory" | "sqlite" | "postgres";

export interface WhatsAppStoreFactoryOptions {
  readonly backend?: string;
  readonly businessContextId: string;
  readonly sessionIdPrefix?: string;
  readonly sqliteDbPath?: string;
  readonly postgres?: PostgresPoolConfigInput;
}

export interface CreatedWhatsAppStore {
  readonly backend: WhatsAppStoreBackend;
  readonly store: WhatsAppStore;
  close(): void;
}

function readRequiredString(value: string | undefined, name: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

export function parseWhatsAppStoreBackend(value: string | undefined): WhatsAppStoreBackend {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "memory";
  }

  if (normalized === "memory" || normalized === "sqlite" || normalized === "postgres") {
    return normalized;
  }

  throw new Error("WHATSAPP_STORE_BACKEND must be one of: memory, sqlite, postgres");
}

export function createWhatsAppStore(options: WhatsAppStoreFactoryOptions): CreatedWhatsAppStore {
  const backend = parseWhatsAppStoreBackend(options.backend);
  const businessContextId = readRequiredString(options.businessContextId, "businessContextId");

  if (backend === "memory") {
    const memoryOptions: InMemoryWhatsAppStoreOptions = {
      businessContextId,
      sessionIdPrefix: options.sessionIdPrefix,
    };

    return {
      backend,
      store: createInMemoryWhatsAppStore(memoryOptions),
      close(): void {
        // In-memory stores do not hold external resources.
      },
    };
  }

  if (backend === "sqlite") {
    const sqliteDbPath = readRequiredString(options.sqliteDbPath, "sqliteDbPath");
    const sqliteStore: SqliteWhatsAppStore = createSqliteWhatsAppStore({
      dbPath: sqliteDbPath,
      businessContextId,
      sessionIdPrefix: options.sessionIdPrefix,
    });

    return {
      backend,
      store: sqliteStore,
      close(): void {
        sqliteStore.close();
      },
    };
  }

  parsePostgresPoolConfig(options.postgres ?? {});
  throw new Error("postgres whatsapp store is not implemented yet");
}

export interface AsyncWhatsAppStoreFactoryOptions extends WhatsAppStoreFactoryOptions {
  readonly migrationAppliedAtIso?: string;
  readonly processedAtIso?: string;
  readonly createPool?: (config: PostgresPoolConfig) => DeterministicPostgresPool;
}

export interface CreatedAsyncWhatsAppStore {
  readonly backend: WhatsAppStoreBackend;
  readonly store: AsyncWhatsAppStore;
  close(): Promise<void>;
}

export async function createAsyncWhatsAppStore(
  options: AsyncWhatsAppStoreFactoryOptions
): Promise<CreatedAsyncWhatsAppStore> {
  const backend = parseWhatsAppStoreBackend(options.backend);

  if (backend === "memory" || backend === "sqlite") {
    const created = createWhatsAppStore(options);

    return {
      backend,
      store: adaptSyncWhatsAppStoreToAsync(created.store),
      async close(): Promise<void> {
        created.close();
      },
    };
  }

  const businessContextId = readRequiredString(options.businessContextId, "businessContextId");
  const config = parsePostgresPoolConfig(options.postgres ?? {});
  const pool = options.createPool ? options.createPool(config) : createPostgresPool({ config });

  try {
    await applyPostgresMigrations(
      pool,
      options.migrationAppliedAtIso ?? "2026-03-24T00:00:00.000Z"
    );
  } catch (error) {
    await pool.close();
    throw error;
  }

  const store = createPostgresWhatsAppStore({
    pool,
    businessContextId,
    sessionIdPrefix: options.sessionIdPrefix,
    processedAtIso: options.processedAtIso,
  });

  return {
    backend,
    store,
    async close(): Promise<void> {
      await store.close();
    },
  };
}