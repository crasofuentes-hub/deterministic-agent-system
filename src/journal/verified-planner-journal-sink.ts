import type {
  VerifiedPlannerStructuredEventEnvelope,
  VerifiedPlannerStructuredEventSink,
} from "../agent-run/verified-planner-observability";
import { mapVerifiedPlannerStructuredEventToJournalEvent } from "./verified-planner-observability-journal";
import type { VerifiedPlannerJournalWriter } from "./verified-planner-journal";

export interface VerifiedPlannerJournalEventSinkOptions {
  readonly journal: VerifiedPlannerJournalWriter;
  readonly sessionId: string;
  readonly eventIdPrefix?: string;
  readonly onError?: (error: unknown) => void;
}

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function reportSinkError(error: unknown, onError: ((error: unknown) => void) | undefined): void {
  if (typeof onError === "function") {
    onError(error);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      subsystem: "llm-live",
      event: "llm_live.planner_journal_sink.error",
      error: message,
    }) + "\n",
  );
}

export function createVerifiedPlannerJournalEventSink(
  options: VerifiedPlannerJournalEventSinkOptions,
): VerifiedPlannerStructuredEventSink {
  const sessionId = readNonEmptyString(options.sessionId, "sessionId");
  const eventIdPrefix =
    typeof options.eventIdPrefix === "string"
      ? readNonEmptyString(options.eventIdPrefix, "eventIdPrefix")
      : undefined;

  return (event: VerifiedPlannerStructuredEventEnvelope): void => {
    const journalEvent = mapVerifiedPlannerStructuredEventToJournalEvent({
      event,
      sessionId,
      eventIdPrefix,
    });

    void Promise.resolve(options.journal.appendEvent(journalEvent)).catch((error: unknown) => {
      reportSinkError(error, options.onError);
    });
  };
}