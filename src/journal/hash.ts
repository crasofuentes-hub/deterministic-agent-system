import { createHash } from "node:crypto";
import type { JournalEventType, StoredJournalEvent } from "./types";

export interface JournalEventHashInput {
  readonly eventId: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly timestamp: string;
  readonly type: JournalEventType;
  readonly payload: Record<string, unknown>;
  readonly hashPrev: string | null;
  readonly metadata?: Record<string, unknown>;
}

function assertSupportedJsonValue(value: unknown): void {
  if (value === undefined) {
    throw new Error("Journal values must not contain undefined");
  }

  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error("Journal values must be JSON-compatible");
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Journal numbers must be finite");
  }
}

export function canonicalJsonStringify(value: unknown): string {
  assertSupportedJsonValue(value);

  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalJsonStringify(item)).join(",") + "]";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();

    return (
      "{" +
      keys
        .map((key) => {
          const item = record[key];

          if (item === undefined) {
            throw new Error("Journal object values must not contain undefined");
          }

          return JSON.stringify(key) + ":" + canonicalJsonStringify(item);
        })
        .join(",") +
      "}"
    );
  }

  throw new Error("Unsupported journal value type");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashJournalEventContent(event: JournalEventHashInput): string {
  return sha256Hex(
    canonicalJsonStringify({
      eventId: event.eventId,
      sessionId: event.sessionId,
      sequence: event.sequence,
      timestamp: event.timestamp,
      type: event.type,
      payload: event.payload,
      hashPrev: event.hashPrev,
      metadata: event.metadata ?? null,
    }),
  );
}

export function verifyJournalEventChain(events: readonly StoredJournalEvent[]): boolean {
  let previousHash: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];

    if (!event) {
      return false;
    }

    if (event.sequence !== index + 1) {
      return false;
    }

    if (event.hashPrev !== previousHash) {
      return false;
    }

    const expectedHash = hashJournalEventContent({
      eventId: event.eventId,
      sessionId: event.sessionId,
      sequence: event.sequence,
      timestamp: event.timestamp,
      type: event.type,
      payload: event.payload,
      hashPrev: event.hashPrev,
      metadata: event.metadata,
    });

    if (event.hashSelf !== expectedHash) {
      return false;
    }

    previousHash = event.hashSelf;
  }

  return true;
}