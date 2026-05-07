import type { ServerResponse } from "node:http";
import type { ExecutionJournal } from "../../journal";
import {
  replaySession,
  replayUntilSequence,
  replayWithOverride,
  type JournalReplayOverride,
  type JournalReplayResult,
} from "../../replay";
import { sendInvalidRequest, sendJson } from "../responses";

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildWhatsAppJournalSessionId(customerId: string): string {
  return "whatsapp:" + customerId;
}

function readPositiveInteger(value: unknown, name: string): number | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(name + " must be a positive integer");
  }

  return value;
}

function readOptionalRecord(value: unknown, name: string): Record<string, unknown> | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (!isObject(value)) {
    throw new Error(name + " must be an object when provided");
  }

  return value;
}

export interface WhatsAppConversationReplayOptions {
  readonly untilSequence?: number;
}

interface ReplayOverrideRequest {
  readonly overrides: readonly JournalReplayOverride[];
}

function validateReplayOverrideRequest(input: unknown): { ok: true; value: ReplayOverrideRequest } | { ok: false; error: string } {
  if (!isObject(input)) {
    return {
      ok: false,
      error: "Request body must be a JSON object",
    };
  }

  if (!Array.isArray(input.overrides) || input.overrides.length === 0) {
    return {
      ok: false,
      error: "overrides must be a non-empty array",
    };
  }

  try {
    const overrides = input.overrides.map((item, index): JournalReplayOverride => {
      if (!isObject(item)) {
        throw new Error("overrides[" + index + "] must be an object");
      }

      const sequence = readPositiveInteger(item.sequence, "overrides[" + index + "].sequence");
      const eventId =
        typeof item.eventId === "undefined"
          ? undefined
          : isNonEmptyString(item.eventId)
            ? item.eventId.trim()
            : undefined;

      if (typeof item.eventId !== "undefined" && typeof eventId === "undefined") {
        throw new Error("overrides[" + index + "].eventId must be a non-empty string when provided");
      }

      const hasSequence = typeof sequence !== "undefined";
      const hasEventId = typeof eventId !== "undefined";

      if (hasSequence === hasEventId) {
        throw new Error("overrides[" + index + "] must specify exactly one of sequence or eventId");
      }

      const payload = readOptionalRecord(item.payload, "overrides[" + index + "].payload");
      const metadata = readOptionalRecord(item.metadata, "overrides[" + index + "].metadata");

      if (typeof payload === "undefined" && typeof metadata === "undefined") {
        throw new Error("overrides[" + index + "] must provide payload or metadata");
      }

      return {
        ...(typeof sequence === "undefined" ? {} : { sequence }),
        ...(typeof eventId === "undefined" ? {} : { eventId }),
        ...(typeof payload === "undefined" ? {} : { payload }),
        ...(typeof metadata === "undefined" ? {} : { metadata }),
      };
    });

    return {
      ok: true,
      value: {
        overrides,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sendReplayResult(
  res: ServerResponse,
  customerId: string,
  sessionId: string,
  replay: JournalReplayResult,
): void {
  if (!replay.ok) {
    sendJson(res, 409, {
      ok: false,
      customerId,
      sessionId,
      integrityOk: replay.integrityOk,
      error: replay.error,
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    customerId,
    sessionId,
    integrityOk: replay.integrityOk,
    replayedUntilSequence: replay.replayedUntilSequence,
    eventsReplayed: replay.eventsReplayed,
    finalState: replay.finalState,
    replayHash: replay.replayHash,
  });
}

export async function handleGetWhatsAppConversationReplay(
  res: ServerResponse,
  journal: ExecutionJournal,
  customerId: string,
  options: WhatsAppConversationReplayOptions = {},
): Promise<void> {
  if (!isNonEmptyString(customerId)) {
    sendJson(res, 400, {
      ok: false,
      error: "customerId must be a non-empty string",
    });
    return;
  }

  const normalizedCustomerId = customerId.trim();
  const sessionId = buildWhatsAppJournalSessionId(normalizedCustomerId);
  const replay =
    typeof options.untilSequence === "number"
      ? await replayUntilSequence(journal, sessionId, options.untilSequence)
      : await replaySession(journal, sessionId);

  sendReplayResult(res, normalizedCustomerId, sessionId, replay);
}

export async function handlePostWhatsAppConversationReplayOverride(
  res: ServerResponse,
  journal: ExecutionJournal,
  customerId: string,
  input: unknown,
): Promise<void> {
  if (!isNonEmptyString(customerId)) {
    sendJson(res, 400, {
      ok: false,
      error: "customerId must be a non-empty string",
    });
    return;
  }

  const validation = validateReplayOverrideRequest(input);

  if (!validation.ok) {
    sendInvalidRequest(res, validation.error);
    return;
  }

  const normalizedCustomerId = customerId.trim();
  const sessionId = buildWhatsAppJournalSessionId(normalizedCustomerId);
  const replay = await replayWithOverride(journal, sessionId, validation.value.overrides);

  sendReplayResult(res, normalizedCustomerId, sessionId, replay);
}