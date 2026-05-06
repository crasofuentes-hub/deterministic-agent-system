import { hashJournalEventContent, verifyJournalEventChain } from "./hash";
import type {
  AppendJournalEventInput,
  ExecutionJournal,
  GetSessionJournalOptions,
  SessionJournal,
  StoredJournalEvent,
} from "./types";

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function cloneJsonRecord(value: Record<string, unknown>, name: string): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    throw new Error(name + " must be JSON-compatible");
  }
}

function cloneStoredEvent(event: StoredJournalEvent): StoredJournalEvent {
  const metadata = event.metadata === undefined ? undefined : cloneJsonRecord(event.metadata, "metadata");

  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    sequence: event.sequence,
    timestamp: event.timestamp,
    type: event.type,
    payload: cloneJsonRecord(event.payload, "payload"),
    hashPrev: event.hashPrev,
    hashSelf: event.hashSelf,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

export function createInMemoryExecutionJournal(): ExecutionJournal {
  const eventsBySessionId = new Map<string, StoredJournalEvent[]>();

  return {
    async appendEvent(event: AppendJournalEventInput): Promise<StoredJournalEvent> {
      const eventId = readNonEmptyString(event.eventId, "eventId");
      const sessionId = readNonEmptyString(event.sessionId, "sessionId");
      const timestamp = readNonEmptyString(event.timestamp, "timestamp");
      const payload = cloneJsonRecord(event.payload, "payload");
      const metadata = event.metadata === undefined ? undefined : cloneJsonRecord(event.metadata, "metadata");

      const sessionEvents = eventsBySessionId.get(sessionId) ?? [];
      const previousEvent = sessionEvents[sessionEvents.length - 1];
      const sequence = sessionEvents.length + 1;
      const hashPrev = previousEvent?.hashSelf ?? null;

      const hashSelf = hashJournalEventContent({
        eventId,
        sessionId,
        sequence,
        timestamp,
        type: event.type,
        payload,
        hashPrev,
        metadata,
      });

      const storedEvent: StoredJournalEvent = {
        eventId,
        sessionId,
        sequence,
        timestamp,
        type: event.type,
        payload,
        hashPrev,
        hashSelf,
        ...(metadata === undefined ? {} : { metadata }),
      };

      sessionEvents.push(storedEvent);
      eventsBySessionId.set(sessionId, sessionEvents);

      return cloneStoredEvent(storedEvent);
    },

    async verifyChain(sessionId: string): Promise<boolean> {
      const normalizedSessionId = readNonEmptyString(sessionId, "sessionId");
      const sessionEvents = eventsBySessionId.get(normalizedSessionId) ?? [];

      return verifyJournalEventChain(sessionEvents);
    },

    async getSessionJournal(
      sessionId: string,
      options: GetSessionJournalOptions = {},
    ): Promise<SessionJournal> {
      const normalizedSessionId = readNonEmptyString(sessionId, "sessionId");
      const sessionEvents = eventsBySessionId.get(normalizedSessionId) ?? [];
      const clonedEvents = sessionEvents.map((event) => cloneStoredEvent(event));

      return {
        sessionId: normalizedSessionId,
        events: clonedEvents,
        ...(options.integrityCheck === true
          ? { integrityOk: verifyJournalEventChain(sessionEvents) }
          : {}),
      };
    },
  };
}