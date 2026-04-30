import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";

export interface HttpMetricRecord {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  error?: string;
}

export interface HttpMetricsSnapshot {
  startedAtIso: string;
  totalRequests: number;
  totalErrors: number;
  totalRateLimited: number;
  byRoute: Array<{
    key: string;
    method: string;
    path: string;
    count: number;
    errors: number;
    rateLimited: number;
    lastStatusCode: number;
    lastDurationMs: number;
  }>;
}

interface RouteMetricBucket {
  method: string;
  path: string;
  count: number;
  errors: number;
  rateLimited: number;
  lastStatusCode: number;
  lastDurationMs: number;
}

const startedAtIso = new Date().toISOString();
const routeBuckets = new Map<string, RouteMetricBucket>();

let totalRequests = 0;
let totalErrors = 0;
let totalRateLimited = 0;

function normalizePath(path: string): string {
  if (path.startsWith("/whatsapp/handoffs/") && path.endsWith("/close")) {
    return "/whatsapp/handoffs/:handoffId/close";
  }

  if (path.startsWith("/whatsapp/conversations/") && path.endsWith("/events")) {
    return "/whatsapp/conversations/:customerId/events";
  }

  if (path.startsWith("/whatsapp/conversations/") && path.endsWith("/evidence")) {
    return "/whatsapp/conversations/:customerId/evidence";
  }

  return path;
}

export function recordHttpMetric(record: HttpMetricRecord): void {
  const path = normalizePath(record.path);
  const method = record.method.toUpperCase();
  const key = method + " " + path;
  const isError = record.statusCode >= 400;
  const isRateLimited = record.statusCode === 429;

  totalRequests += 1;

  if (isError) {
    totalErrors += 1;
  }

  if (isRateLimited) {
    totalRateLimited += 1;
  }

  const existing =
    routeBuckets.get(key) ??
    ({
      method,
      path,
      count: 0,
      errors: 0,
      rateLimited: 0,
      lastStatusCode: record.statusCode,
      lastDurationMs: record.durationMs,
    } satisfies RouteMetricBucket);

  existing.count += 1;
  existing.lastStatusCode = record.statusCode;
  existing.lastDurationMs = record.durationMs;

  if (isError) {
    existing.errors += 1;
  }

  if (isRateLimited) {
    existing.rateLimited += 1;
  }

  routeBuckets.set(key, existing);
}

export function getHttpMetricsSnapshot(): HttpMetricsSnapshot {
  return {
    startedAtIso,
    totalRequests,
    totalErrors,
    totalRateLimited,
    byRoute: [...routeBuckets.entries()]
      .map(([key, bucket]) => ({
        key,
        ...bucket,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function resetHttpMetricsForTests(): void {
  routeBuckets.clear();
  totalRequests = 0;
  totalErrors = 0;
  totalRateLimited = 0;
}

export function handleMetrics(res: ServerResponse): void {
  sendJson(res, 200, {
    ok: true,
    metrics: getHttpMetricsSnapshot(),
  });
}