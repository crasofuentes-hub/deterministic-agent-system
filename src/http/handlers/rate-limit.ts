import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../responses";

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, RateLimitBucket>();

function readPositiveInteger(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function readClientId(request: IncomingMessage): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return realIp.trim();
  }

  const socketAddress = request.socket?.remoteAddress;
  if (typeof socketAddress === "string" && socketAddress.trim().length > 0) {
    return socketAddress.trim();
  }

  return "unknown";
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
}

export function resolveRateLimitConfig(env: Record<string, string | undefined>): RateLimitConfig {
  const windowMs = readPositiveInteger(env.HTTP_RATE_LIMIT_WINDOW_MS);
  const maxRequests = readPositiveInteger(env.HTTP_RATE_LIMIT_MAX);

  if (!windowMs || !maxRequests) {
    return {
      enabled: false,
      windowMs: 0,
      maxRequests: 0,
    };
  }

  return {
    enabled: true,
    windowMs,
    maxRequests,
  };
}

export function enforceRateLimit(
  request: IncomingMessage,
  response: ServerResponse,
  scope: string,
  config: RateLimitConfig,
  nowMs = Date.now()
): boolean {
  if (!config.enabled) {
    return true;
  }

  const clientId = readClientId(request);
  const key = scope + ":" + clientId;
  const existing = buckets.get(key);

  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(key, {
      count: 1,
      resetAtMs: nowMs + config.windowMs,
    });
    return true;
  }

  if (existing.count >= config.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000));
    response.setHeader("retry-after", String(retryAfterSeconds));

    sendJson(response, 429, {
      ok: false,
      error: "rate limit exceeded",
      retryAfterSeconds,
    });
    return false;
  }

  existing.count += 1;
  buckets.set(key, existing);
  return true;
}

export function resetRateLimitStateForTests(): void {
  buckets.clear();
}