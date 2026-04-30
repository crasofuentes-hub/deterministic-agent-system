import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";

export interface ReadinessCheck {
  id: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

function readTrimmed(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPositiveInteger(value: string | undefined): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0;
}

function requireEnv(
  env: Record<string, string | undefined>,
  key: string,
  id: string,
  description: string
): ReadinessCheck {
  return readTrimmed(env, key)
    ? {
        id,
        status: "pass",
        message: description + " is configured",
      }
    : {
        id,
        status: "fail",
        message: description + " is not configured",
      };
}

export function buildReadinessChecks(env: Record<string, string | undefined>): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  checks.push({
    id: "http.service",
    status: "pass",
    message: "HTTP service is running",
  });

  checks.push(requireEnv(env, "WHATSAPP_VERIFY_TOKEN", "whatsapp.verifyToken", "WhatsApp verify token"));
  checks.push(requireEnv(env, "OPS_API_TOKEN", "ops.apiToken", "Ops API token"));

  const deliveryMode = readTrimmed(env, "WHATSAPP_DELIVERY_MODE") ?? "skipped";
  if (deliveryMode === "http") {
    checks.push(
      requireEnv(env, "WHATSAPP_API_VERSION", "whatsapp.http.apiVersion", "WhatsApp API version")
    );
    checks.push(
      requireEnv(
        env,
        "WHATSAPP_PHONE_NUMBER_ID",
        "whatsapp.http.phoneNumberId",
        "WhatsApp phone number id"
      )
    );
    checks.push(
      requireEnv(env, "WHATSAPP_ACCESS_TOKEN", "whatsapp.http.accessToken", "WhatsApp access token")
    );
  } else {
    checks.push({
      id: "whatsapp.deliveryMode",
      status: "pass",
      message: "WhatsApp delivery mode is " + deliveryMode,
    });
  }

  const storeMode = readTrimmed(env, "WHATSAPP_STORE_MODE") ?? "memory";
  if (storeMode !== "memory" && storeMode !== "sqlite") {
    checks.push({
      id: "whatsapp.storeMode",
      status: "fail",
      message: "WhatsApp store mode must be memory or sqlite",
    });
  } else {
    checks.push({
      id: "whatsapp.storeMode",
      status: "pass",
      message: "WhatsApp store mode is " + storeMode,
    });
  }

  if (storeMode === "sqlite") {
    checks.push(
      requireEnv(env, "WHATSAPP_SQLITE_PATH", "whatsapp.sqlitePath", "WhatsApp SQLite path")
    );
  }

  if (readTrimmed(env, "WHATSAPP_APP_SECRET")) {
    checks.push({
      id: "whatsapp.appSecret",
      status: "pass",
      message: "WhatsApp app secret is configured for signed webhook POST validation",
    });
  } else {
    checks.push({
      id: "whatsapp.appSecret",
      status: "warn",
      message: "WhatsApp app secret is not configured; signed webhook POST validation is disabled",
    });
  }

  const hasRateLimitWindow = isPositiveInteger(env.HTTP_RATE_LIMIT_WINDOW_MS);
  const hasRateLimitMax = isPositiveInteger(env.HTTP_RATE_LIMIT_MAX);

  if (hasRateLimitWindow && hasRateLimitMax) {
    checks.push({
      id: "http.rateLimit",
      status: "pass",
      message: "HTTP rate limiting is configured",
    });
  } else if (!readTrimmed(env, "HTTP_RATE_LIMIT_WINDOW_MS") && !readTrimmed(env, "HTTP_RATE_LIMIT_MAX")) {
    checks.push({
      id: "http.rateLimit",
      status: "warn",
      message: "HTTP rate limiting is not configured",
    });
  } else {
    checks.push({
      id: "http.rateLimit",
      status: "fail",
      message: "HTTP rate limiting must define positive integer HTTP_RATE_LIMIT_WINDOW_MS and HTTP_RATE_LIMIT_MAX",
    });
  }

  return checks;
}

export function handleReadiness(
  res: ServerResponse,
  env: Record<string, string | undefined>
): void {
  const checks = buildReadinessChecks(env);
  const ready = checks.every((check) => check.status !== "fail");

  sendJson(res, ready ? 200 : 503, {
    ok: ready,
    status: ready ? "ready" : "not-ready",
    checks,
  });
}