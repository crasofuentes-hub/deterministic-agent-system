import type { PostgresPoolConfig } from "../../storage/postgres-config";
import type { DeterministicPostgresPool } from "../../storage/postgres-pool";
import { createMockWhatsAppSender, type WhatsAppSender } from "./client";
import { createHttpWhatsAppSender, type WhatsAppHttpFetch } from "./send-http";
import type { AsyncWhatsAppStore } from "./store-async";
import {
  createAsyncWhatsAppStore,
  type WhatsAppStoreBackend,
} from "./store-factory";
import type { WhatsAppDeliveryMode } from "./runtime";

export interface AsyncWhatsAppRuntimeConfig {
  verifyToken: string;
  deliveryMode: WhatsAppDeliveryMode;
  sender?: WhatsAppSender;
  store: AsyncWhatsAppStore;
  close(): Promise<void>;
}

export interface ResolveAsyncWhatsAppRuntimeParams {
  env: Record<string, string | undefined>;
  fetchImpl?: WhatsAppHttpFetch;
  createPostgresPool?: (config: PostgresPoolConfig) => DeterministicPostgresPool;
}

function readTrimmedNonEmpty(
  env: Record<string, string | undefined>,
  key: string
): string | undefined {
  const value = env[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStoreMode(env: Record<string, string | undefined>): WhatsAppStoreBackend {
  const storeMode = readTrimmedNonEmpty(env, "WHATSAPP_STORE_MODE") ?? "memory";

  if (storeMode !== "memory" && storeMode !== "sqlite" && storeMode !== "postgres") {
    throw new Error("WHATSAPP_STORE_MODE must be one of: memory, sqlite, postgres");
  }

  return storeMode;
}

function readDeliveryMode(env: Record<string, string | undefined>): WhatsAppDeliveryMode {
  const deliveryMode = readTrimmedNonEmpty(env, "WHATSAPP_DELIVERY_MODE") ?? "skipped";

  if (deliveryMode !== "skipped" && deliveryMode !== "mock" && deliveryMode !== "http") {
    throw new Error("WHATSAPP_DELIVERY_MODE must be one of: skipped, mock, http");
  }

  return deliveryMode;
}

export async function resolveAsyncWhatsAppRuntime(
  params: ResolveAsyncWhatsAppRuntimeParams
): Promise<AsyncWhatsAppRuntimeConfig> {
  const verifyToken = readTrimmedNonEmpty(params.env, "WHATSAPP_VERIFY_TOKEN");

  if (!verifyToken) {
    throw new Error("WHATSAPP_VERIFY_TOKEN is required");
  }

  const storeMode = readStoreMode(params.env);
  const deliveryMode = readDeliveryMode(params.env);

  const businessContextId =
    readTrimmedNonEmpty(params.env, "WHATSAPP_BUSINESS_CONTEXT_ID") ?? "customer-service-core-v2";

  const sessionIdPrefix =
    readTrimmedNonEmpty(params.env, "WHATSAPP_SESSION_ID_PREFIX") ?? "whatsapp-session";

  const sqliteDbPath =
    storeMode === "sqlite" ? readTrimmedNonEmpty(params.env, "WHATSAPP_SQLITE_PATH") : undefined;

  if (storeMode === "sqlite" && !sqliteDbPath) {
    throw new Error("WHATSAPP_SQLITE_PATH is required for sqlite store mode");
  }

  const createdStore = await createAsyncWhatsAppStore({
    backend: storeMode,
    businessContextId,
    sessionIdPrefix,
    sqliteDbPath,
    postgres: {
      DATABASE_URL: readTrimmedNonEmpty(params.env, "DATABASE_URL"),
      POSTGRES_POOL_MAX: readTrimmedNonEmpty(params.env, "POSTGRES_POOL_MAX"),
      POSTGRES_IDLE_TIMEOUT_MS: readTrimmedNonEmpty(params.env, "POSTGRES_IDLE_TIMEOUT_MS"),
      POSTGRES_CONNECTION_TIMEOUT_MS: readTrimmedNonEmpty(
        params.env,
        "POSTGRES_CONNECTION_TIMEOUT_MS"
      ),
      POSTGRES_STATEMENT_TIMEOUT_MS: readTrimmedNonEmpty(
        params.env,
        "POSTGRES_STATEMENT_TIMEOUT_MS"
      ),
    },
    migrationAppliedAtIso: readTrimmedNonEmpty(params.env, "POSTGRES_MIGRATION_APPLIED_AT_ISO"),
    processedAtIso: readTrimmedNonEmpty(params.env, "WHATSAPP_PROCESSED_AT_ISO"),
    createPool: params.createPostgresPool,
  });

  const close = async (): Promise<void> => {
    await createdStore.close();
  };

  if (deliveryMode === "skipped") {
    return {
      verifyToken,
      deliveryMode,
      store: createdStore.store,
      close,
    };
  }

  if (deliveryMode === "mock") {
    return {
      verifyToken,
      deliveryMode,
      sender: createMockWhatsAppSender(),
      store: createdStore.store,
      close,
    };
  }

  const apiVersion = readTrimmedNonEmpty(params.env, "WHATSAPP_API_VERSION");

  if (!apiVersion) {
    await close();
    throw new Error("WHATSAPP_API_VERSION is required for http mode");
  }

  const phoneNumberId = readTrimmedNonEmpty(params.env, "WHATSAPP_PHONE_NUMBER_ID");

  if (!phoneNumberId) {
    await close();
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is required for http mode");
  }

  const accessToken = readTrimmedNonEmpty(params.env, "WHATSAPP_ACCESS_TOKEN");

  if (!accessToken) {
    await close();
    throw new Error("WHATSAPP_ACCESS_TOKEN is required for http mode");
  }

  if (!params.fetchImpl) {
    await close();
    throw new Error("fetchImpl is required for http mode");
  }

  return {
    verifyToken,
    deliveryMode,
    sender: createHttpWhatsAppSender({
      apiVersion,
      phoneNumberId,
      accessToken,
      fetchImpl: params.fetchImpl,
    }),
    store: createdStore.store,
    close,
  };
}