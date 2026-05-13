import { setVerifiedPlannerStructuredEventSink } from "../agent-run/verified-planner-observability";
import {
  createVerifiedPlannerJournalEventSink,
  type VerifiedPlannerJournalEventSinkOptions,
} from "./verified-planner-journal-sink";

export function withVerifiedPlannerJournalEventSink<T>(
  options: VerifiedPlannerJournalEventSinkOptions,
  operation: () => T,
): T {
  const restore = setVerifiedPlannerStructuredEventSink(
    createVerifiedPlannerJournalEventSink(options),
  );

  try {
    return operation();
  } finally {
    restore();
  }
}

export async function withVerifiedPlannerJournalEventSinkAsync<T>(
  options: VerifiedPlannerJournalEventSinkOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const restore = setVerifiedPlannerStructuredEventSink(
    createVerifiedPlannerJournalEventSink(options),
  );

  try {
    return await operation();
  } finally {
    restore();
  }
}