import fs from "node:fs";
import path from "node:path";
import { startServer } from "../http/server";

type DeliveryMode = "skipped" | "mock" | "http";
type StoreMode = "memory" | "sqlite";

interface LivePilotConfig {
  host: string;
  port: number;
  verifyToken: string;
  deliveryMode: DeliveryMode;
  storeMode: StoreMode;
  sqlitePath?: string;
  businessContextId: string;
  sessionIdPrefix: string;
  apiVersion?: string;
  phoneNumberId?: string;
  accessTokenPresent: boolean;
}

function readTrimmedNonEmpty(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return parsed;
}

function resolveDeliveryMode(value: string | undefined): DeliveryMode {
  const normalized = (value ?? "skipped").trim();
  if (normalized === "skipped" || normalized === "mock" || normalized === "http") {
    return normalized;
  }
  throw new Error("WHATSAPP_DELIVERY_MODE must be one of: skipped, mock, http");
}

function resolveStoreMode(value: string | undefined): StoreMode {
  const normalized = (value ?? "sqlite").trim();
  if (normalized === "memory" || normalized === "sqlite") {
    return normalized;
  }
  throw new Error("WHATSAPP_STORE_MODE must be one of: memory, sqlite");
}

function ensureParentDirectory(filePath: string): void {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
}

function resolveLivePilotConfig(env: Record<string, string | undefined>): LivePilotConfig {
  const host = readTrimmedNonEmpty(env, "HOST") ?? "127.0.0.1";
  const port = parsePort(readTrimmedNonEmpty(env, "PORT"), 3000);
  const verifyToken = readTrimmedNonEmpty(env, "WHATSAPP_VERIFY_TOKEN");
  if (!verifyToken) {
    throw new Error("WHATSAPP_VERIFY_TOKEN is required");
  }
  const deliveryMode = resolveDeliveryMode(readTrimmedNonEmpty(env, "WHATSAPP_DELIVERY_MODE"));
  const storeMode = resolveStoreMode(readTrimmedNonEmpty(env, "WHATSAPP_STORE_MODE"));
  const businessContextId = readTrimmedNonEmpty(env, "WHATSAPP_BUSINESS_CONTEXT_ID") ?? "customer-service-core-v2";
  const sessionIdPrefix = readTrimmedNonEmpty(env, "WHATSAPP_SESSION_ID_PREFIX") ?? "whatsapp-session";
  let sqlitePath: string | undefined;
  if (storeMode === "sqlite") {
    sqlitePath = readTrimmedNonEmpty(env, "WHATSAPP_SQLITE_PATH");
    if (!sqlitePath) {
      throw new Error("WHATSAPP_SQLITE_PATH is required when WHATSAPP_STORE_MODE=sqlite");
    }
    sqlitePath = path.resolve(sqlitePath);
    ensureParentDirectory(sqlitePath);
  }
  let apiVersion: string | undefined;
  let phoneNumberId: string | undefined;
  let accessTokenPresent = false;
  if (deliveryMode === "http") {
    apiVersion = readTrimmedNonEmpty(env, "WHATSAPP_API_VERSION");
    if (!apiVersion) {
      throw new Error("WHATSAPP_API_VERSION is required when WHATSAPP_DELIVERY_MODE=http");
    }
    phoneNumberId = readTrimmedNonEmpty(env, "WHATSAPP_PHONE_NUMBER_ID");
    if (!phoneNumberId) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID is required when WHATSAPP_DELIVERY_MODE=http");
    }
    const accessToken = readTrimmedNonEmpty(env, "WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("WHATSAPP_ACCESS_TOKEN is required when WHATSAPP_DELIVERY_MODE=http");
    }
    accessTokenPresent = true;
  }
  return {
    host,
    port,
    verifyToken,
    deliveryMode,
    storeMode,
    sqlitePath,
    businessContextId,
    sessionIdPrefix,
    apiVersion,
    phoneNumberId,
    accessTokenPresent,
  };
}

function printSummary(config: LivePilotConfig): void {
  const lines = [
    "",
    "=== Live Pilot Runtime ===",
    "Host: " + config.host,
    "Port: " + String(config.port),
    "Verify token: configured",
    "Delivery mode: " + config.deliveryMode,
    "Store mode: " + config.storeMode,
    "Business context: " + config.businessContextId,
    "Session id prefix: " + config.sessionIdPrefix,
    "SQLite path: " + (config.sqlitePath ?? "n/a"),
    "HTTP API version: " + (config.apiVersion ?? "n/a"),
    "HTTP phone number id: " + (config.phoneNumberId ?? "n/a"),
    "HTTP access token: " + (config.accessTokenPresent ? "configured" : "n/a"),
    "Base URL: http://" + config.host + ":" + String(config.port),
    "",
  ];
  process.stdout.write(lines.join("\n"));
}

async function main(): Promise<void> {
  const config = resolveLivePilotConfig(process.env as Record<string, string | undefined>);
  printSummary(config);
  const running = await startServer({
    host: config.host,
    port: config.port,
  });
  process.stdout.write(
    "Live pilot server listening on http://" + running.host + ":" + String(running.port) + "\n"
  );
  process.stdout.write("Health endpoint: http://" + running.host + ":" + String(running.port) + "/health\n");
  process.stdout.write("WhatsApp webhook: http://" + running.host + ":" + String(running.port) + "/webhooks/whatsapp\n");
  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    process.stdout.write("Shutting down live pilot server on " + signal + "...\n");
    try {
      await running.close();
      process.stdout.write("Live pilot server stopped cleanly.\n");
      process.exitCode = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write("Shutdown failed: " + message + "\n");
      process.exitCode = 1;
    } finally {
      process.exit();
    }
  };
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  await new Promise<void>(() => {});
}

void main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write("Fatal error: " + message + "\n");
  process.exit(1);
});