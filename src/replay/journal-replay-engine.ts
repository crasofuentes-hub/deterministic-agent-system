import {
  canonicalJsonStringify,
  sha256Hex,
  type ExecutionJournal,
  type StoredJournalEvent,
} from "../journal";

export interface JournalReplayOverride {
  readonly sequence?: number;
  readonly eventId?: string;
  readonly payload?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface AppliedJournalReplayOverride {
  readonly sequence: number;
  readonly eventId: string;
  readonly changedPayload: boolean;
  readonly changedMetadata: boolean;
}

export interface JournalReplayState {
  readonly sessionId: string;
  readonly eventCount: number;
  readonly eventTypes: Record<string, number>;
  readonly lastEventId: string | null;
  readonly lastEventType: string | null;
  readonly lastSequence: number | null;
  readonly lastTimestamp: string | null;
  readonly appliedOverrides: readonly AppliedJournalReplayOverride[];
}

export interface JournalReplaySuccess {
  readonly ok: true;
  readonly sessionId: string;
  readonly integrityOk: true;
  readonly replayedUntilSequence: number | null;
  readonly eventsReplayed: number;
  readonly events: readonly StoredJournalEvent[];
  readonly finalState: JournalReplayState;
  readonly replayHash: string;
}

export interface JournalReplayFailure {
  readonly ok: false;
  readonly sessionId: string;
  readonly integrityOk: false;
  readonly error: {
    readonly code:
      | "JOURNAL_INTEGRITY_CHECK_FAILED"
      | "REPLAY_SEQUENCE_NOT_FOUND"
      | "INVALID_REPLAY_OVERRIDE";
    readonly message: string;
  };
}

export type JournalReplayResult = JournalReplaySuccess | JournalReplayFailure;

interface InternalReplayOptions {
  readonly untilSequence?: number;
  readonly overrides?: readonly JournalReplayOverride[];
}

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function readPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(name + " must be a positive integer");
  }

  return value;
}

function cloneJsonRecord(value: Record<string, unknown>, name: string): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    throw new Error(name + " must be JSON-compatible");
  }
}

function cloneStoredEvent(event: StoredJournalEvent): StoredJournalEvent {
  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    sequence: event.sequence,
    timestamp: event.timestamp,
    type: event.type,
    payload: cloneJsonRecord(event.payload, "payload"),
    hashPrev: event.hashPrev,
    hashSelf: event.hashSelf,
    ...(event.metadata === undefined
      ? {}
      : { metadata: cloneJsonRecord(event.metadata, "metadata") }),
  };
}

function buildOverrideKey(override: JournalReplayOverride): string | JournalReplayFailure["error"] {
  const hasSequence = typeof override.sequence !== "undefined";
  const hasEventId = typeof override.eventId !== "undefined";

  if (hasSequence === hasEventId) {
    return {
      code: "INVALID_REPLAY_OVERRIDE",
      message: "Replay override must specify exactly one of sequence or eventId",
    };
  }

  if (hasSequence) {
    return "sequence:" + readPositiveInteger(override.sequence as number, "override.sequence");
  }

  return "eventId:" + readNonEmptyString(override.eventId as string, "override.eventId");
}

function indexOverrides(
  overrides: readonly JournalReplayOverride[],
): Map<string, JournalReplayOverride> | JournalReplayFailure["error"] {
  const indexed = new Map<string, JournalReplayOverride>();

  for (const override of overrides) {
    const key = buildOverrideKey(override);

    if (typeof key !== "string") {
      return key;
    }

    if (indexed.has(key)) {
      return {
        code: "INVALID_REPLAY_OVERRIDE",
        message: "Duplicate replay override for " + key,
      };
    }

    indexed.set(key, override);
  }

  return indexed;
}

function applyOverrides(
  events: readonly StoredJournalEvent[],
  overrides: readonly JournalReplayOverride[],
): { readonly events: readonly StoredJournalEvent[]; readonly applied: readonly AppliedJournalReplayOverride[] } | JournalReplayFailure["error"] {
  const indexed = indexOverrides(overrides);

  if (!(indexed instanceof Map)) {
    return indexed;
  }

  const applied: AppliedJournalReplayOverride[] = [];

  const replayEvents = events.map((event) => {
    const sequenceOverride = indexed.get("sequence:" + event.sequence);
    const eventIdOverride = indexed.get("eventId:" + event.eventId);
    const override = sequenceOverride ?? eventIdOverride;

    if (!override) {
      return cloneStoredEvent(event);
    }

    const changedPayload = typeof override.payload !== "undefined";
    const changedMetadata = typeof override.metadata !== "undefined";

    applied.push({
      sequence: event.sequence,
      eventId: event.eventId,
      changedPayload,
      changedMetadata,
    });

    return {
      ...cloneStoredEvent(event),
      ...(changedPayload ? { payload: cloneJsonRecord(override.payload as Record<string, unknown>, "override.payload") } : {}),
      ...(changedMetadata ? { metadata: cloneJsonRecord(override.metadata as Record<string, unknown>, "override.metadata") } : {}),
    };
  });

  for (const key of indexed.keys()) {
    const matched = replayEvents.some((event) => {
      return key === "sequence:" + event.sequence || key === "eventId:" + event.eventId;
    });

    if (!matched) {
      return {
        code: "INVALID_REPLAY_OVERRIDE",
        message: "Replay override did not match any event: " + key,
      };
    }
  }

  return {
    events: replayEvents,
    applied,
  };
}

function reduceReplayState(
  sessionId: string,
  events: readonly StoredJournalEvent[],
  appliedOverrides: readonly AppliedJournalReplayOverride[],
): JournalReplayState {
  const eventTypes: Record<string, number> = {};

  for (const event of events) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
  }

  const lastEvent = events[events.length - 1];

  return {
    sessionId,
    eventCount: events.length,
    eventTypes,
    lastEventId: lastEvent?.eventId ?? null,
    lastEventType: lastEvent?.type ?? null,
    lastSequence: lastEvent?.sequence ?? null,
    lastTimestamp: lastEvent?.timestamp ?? null,
    appliedOverrides,
  };
}

function computeReplayHash(result: {
  readonly sessionId: string;
  readonly replayedUntilSequence: number | null;
  readonly events: readonly StoredJournalEvent[];
  readonly finalState: JournalReplayState;
}): string {
  return sha256Hex(
    canonicalJsonStringify({
      sessionId: result.sessionId,
      replayedUntilSequence: result.replayedUntilSequence,
      eventHashes: result.events.map((event) => event.hashSelf),
      replayEvents: result.events.map((event) => ({
        eventId: event.eventId,
        sessionId: event.sessionId,
        sequence: event.sequence,
        timestamp: event.timestamp,
        type: event.type,
        payload: event.payload,
        metadata: event.metadata ?? null,
        hashPrev: event.hashPrev,
        hashSelf: event.hashSelf,
      })),
      finalState: result.finalState,
    }),
  );
}

async function replayInternal(
  journal: ExecutionJournal,
  sessionIdInput: string,
  options: InternalReplayOptions = {},
): Promise<JournalReplayResult> {
  const sessionId = readNonEmptyString(sessionIdInput, "sessionId");

  const sessionJournal = await journal.getSessionJournal(sessionId, {
    integrityCheck: true,
  });

  if (sessionJournal.integrityOk !== true) {
    return {
      ok: false,
      sessionId,
      integrityOk: false,
      error: {
        code: "JOURNAL_INTEGRITY_CHECK_FAILED",
        message: "Journal integrity check failed for session: " + sessionId,
      },
    };
  }

  let events = sessionJournal.events.map((event) => cloneStoredEvent(event));
  let replayedUntilSequence: number | null = null;

  if (typeof options.untilSequence !== "undefined") {
    const untilSequence = readPositiveInteger(options.untilSequence, "sequence");
    const exists = events.some((event) => event.sequence === untilSequence);

    if (!exists) {
      return {
        ok: false,
        sessionId,
        integrityOk: false,
        error: {
          code: "REPLAY_SEQUENCE_NOT_FOUND",
          message: "Replay sequence was not found: " + untilSequence,
        },
      };
    }

    events = events.filter((event) => event.sequence <= untilSequence);
    replayedUntilSequence = untilSequence;
  } else {
    replayedUntilSequence = events.length > 0 ? events[events.length - 1]!.sequence : null;
  }

  const overrideResult = applyOverrides(events, options.overrides ?? []);

  if (!("events" in overrideResult)) {
    return {
      ok: false,
      sessionId,
      integrityOk: false,
      error: overrideResult,
    };
  }

  const finalState = reduceReplayState(sessionId, overrideResult.events, overrideResult.applied);
  const replayHash = computeReplayHash({
    sessionId,
    replayedUntilSequence,
    events: overrideResult.events,
    finalState,
  });

  return {
    ok: true,
    sessionId,
    integrityOk: true,
    replayedUntilSequence,
    eventsReplayed: overrideResult.events.length,
    events: overrideResult.events,
    finalState,
    replayHash,
  };
}

export function replaySession(
  journal: ExecutionJournal,
  sessionId: string,
): Promise<JournalReplayResult> {
  return replayInternal(journal, sessionId);
}

export function replayUntilSequence(
  journal: ExecutionJournal,
  sessionId: string,
  sequence: number,
): Promise<JournalReplayResult> {
  return replayInternal(journal, sessionId, {
    untilSequence: sequence,
  });
}

export function replayWithOverride(
  journal: ExecutionJournal,
  sessionId: string,
  overrides: readonly JournalReplayOverride[],
): Promise<JournalReplayResult> {
  return replayInternal(journal, sessionId, {
    overrides,
  });
}