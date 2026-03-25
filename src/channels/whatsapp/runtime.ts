import { createMockWhatsAppSender, type WhatsAppSender } from "./client";
import { createHttpWhatsAppSender, type WhatsAppHttpFetch } from "./send-http";

export type WhatsAppDeliveryMode = "skipped" | "mock" | "http";

export interface WhatsAppRuntimeConfig {
  verifyToken: string;
  deliveryMode: WhatsAppDeliveryMode;
  sender?: WhatsAppSender;
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

  const deliveryMode = readTrimmedNonEmpty(params.env, "WHATSAPP_DELIVERY_MODE") ?? "skipped";

  if (deliveryMode !== "skipped" && deliveryMode !== "mock" && deliveryMode !== "http") {
    throw new Error("WHATSAPP_DELIVERY_MODE must be one of: skipped, mock, http");
  }

  if (deliveryMode === "skipped") {
    return {
      verifyToken,
      deliveryMode,
    };
  }

  if (deliveryMode === "mock") {
    return {
      verifyToken,
      deliveryMode,
      sender: createMockWhatsAppSender(),
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
  };
}
