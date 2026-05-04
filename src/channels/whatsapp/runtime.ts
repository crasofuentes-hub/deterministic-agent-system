import { createMockWhatsAppSender, type WhatsAppSender } from "./client";
import { createHttpWhatsAppSender, type WhatsAppHttpFetch } from "./send-http";
import type { WhatsAppStore } from "./store";
import { createWhatsAppStore, type WhatsAppStoreBackend } from "./store-factory";

export type WhatsAppDeliveryMode = "skipped" | "mock" | "http";
export type WhatsAppStoreMode = WhatsAppStoreBackend;

export interface WhatsAppRuntimeConfig {
  verifyToken: string;
  deliveryMode: WhatsAppDeliveryMode;
  sender?: WhatsAppSender;
  store: WhatsAppStore;
}

export interface ResolveWhatsAppRuntimeParams {
  env: Record<string, string | undefined>;
  fetchImpl?: WhatsAppHttpFetch;
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

export function resolveWhatsAppRuntime(
  params: ResolveWhatsAppRuntimeParams
): WhatsAppRuntimeConfig {
  const verifyToken = readTrimmedNonEmpty(params.env, "WHATSAPP_VERIFY_TOKEN");
  if (!verifyToken) {
    throw new Error("WHATSAPP_VERIFY_TOKEN is required");
  }

  const storeMode = readTrimmedNonEmpty(params.env, "WHATSAPP_STORE_MODE") ?? "memory";

  if (storeMode !== "memory" && storeMode !== "sqlite" && storeMode !== "postgres") {
    throw new Error("WHATSAPP_STORE_MODE must be one of: memory, sqlite, postgres");
  }

  const businessContextId =
    readTrimmedNonEmpty(params.env, "WHATSAPP_BUSINESS_CONTEXT_ID") ?? "customer-service-core-v2";

  const sessionIdPrefix =
    readTrimmedNonEmpty(params.env, "WHATSAPP_SESSION_ID_PREFIX") ?? "whatsapp-session";

  const sqliteDbPath =
    storeMode === "sqlite" ? readTrimmedNonEmpty(params.env, "WHATSAPP_SQLITE_PATH") : undefined;

  if (storeMode === "sqlite" && !sqliteDbPath) {
    throw new Error("WHATSAPP_SQLITE_PATH is required for sqlite store mode");
  }

  const createdStore = createWhatsAppStore({
    backend: storeMode,
    businessContextId,
    sessionIdPrefix,
    sqliteDbPath,
    postgres: {
      DATABASE_URL: readTrimmedNonEmpty(params.env, "DATABASE_URL"),
      POSTGRES_POOL_MAX: readTrimmedNonEmpty(params.env, "POSTGRES_POOL_MAX"),
      POSTGRES_IDLE_TIMEOUT_MS: readTrimmedNonEmpty(params.env, "POSTGRES_IDLE_TIMEOUT_MS"),
      POSTGRES_CONNECTION_TIMEOUT_MS: readTrimmedNonEmpty(params.env, "POSTGRES_CONNECTION_TIMEOUT_MS"),
      POSTGRES_STATEMENT_TIMEOUT_MS: readTrimmedNonEmpty(params.env, "POSTGRES_STATEMENT_TIMEOUT_MS"),
    },
  });

  const store = createdStore.store;

  const deliveryMode = readTrimmedNonEmpty(params.env, "WHATSAPP_DELIVERY_MODE") ?? "skipped";

  if (deliveryMode !== "skipped" && deliveryMode !== "mock" && deliveryMode !== "http") {
    throw new Error("WHATSAPP_DELIVERY_MODE must be one of: skipped, mock, http");
  }

  if (deliveryMode === "skipped") {
    return {
      verifyToken,
      deliveryMode,
      store,
    };
  }

  if (deliveryMode === "mock") {
    return {
      verifyToken,
      deliveryMode,
      sender: createMockWhatsAppSender(),
      store,
    };
  }

  const apiVersion = readTrimmedNonEmpty(params.env, "WHATSAPP_API_VERSION");
  if (!apiVersion) {
    throw new Error("WHATSAPP_API_VERSION is required for http mode");
  }

  const phoneNumberId = readTrimmedNonEmpty(params.env, "WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is required for http mode");
  }

  const accessToken = readTrimmedNonEmpty(params.env, "WHATSAPP_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is required for http mode");
  }

  if (!params.fetchImpl) {
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
    store,
  };
}
