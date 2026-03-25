import { createMockWhatsAppSender, type WhatsAppSender } from "./client";
import { createHttpWhatsAppSender, type WhatsAppHttpFetch } from "./send-http";
import { createInMemoryWhatsAppStore, type WhatsAppStore } from "./store";
import { createSqliteWhatsAppStore } from "./store-sqlite";

export type WhatsAppDeliveryMode = "skipped" | "mock" | "http";
export type WhatsAppStoreMode = "memory" | "sqlite";

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

  if (storeMode !== "memory" && storeMode !== "sqlite") {
    throw new Error("WHATSAPP_STORE_MODE must be one of: memory, sqlite");
  }

  const businessContextId =
    readTrimmedNonEmpty(params.env, "WHATSAPP_BUSINESS_CONTEXT_ID") ?? "customer-service-core-v2";

  const sessionIdPrefix =
    readTrimmedNonEmpty(params.env, "WHATSAPP_SESSION_ID_PREFIX") ?? "whatsapp-session";

  const store =
    storeMode === "memory"
      ? createInMemoryWhatsAppStore({
          businessContextId,
          sessionIdPrefix,
        })
      : (() => {
          const dbPath = readTrimmedNonEmpty(params.env, "WHATSAPP_SQLITE_PATH");
          if (!dbPath) {
            throw new Error("WHATSAPP_SQLITE_PATH is required for sqlite store mode");
          }

          return createSqliteWhatsAppStore({
            dbPath,
            businessContextId,
            sessionIdPrefix,
          });
        })();

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
