import type { VerifiedPlannerStructuredEvent } from "../agent-run/verified-planner-observability";
import {
  buildVerifiedPlannerJournalEvent,
  type VerifiedPlannerJournalAppendInput,
  type VerifiedPlannerJournalEventType,
} from "./verified-planner-journal";

export interface VerifiedPlannerObservabilityJournalMappingInput {
  readonly event: VerifiedPlannerStructuredEvent;
  readonly sessionId: string;
  readonly eventIdPrefix?: string;
}

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function mapStructuredEventName(eventName: VerifiedPlannerStructuredEvent["event"]): VerifiedPlannerJournalEventType {
  if (eventName === "llm_live.planner_prompt.received") {
    return "planner_prompt_received";
  }

  if (eventName === "llm_live.planner_prompt.verified") {
    return "planner_prompt_verified";
  }

  if (eventName === "llm_live.planner_prompt.rejected") {
    return "planner_prompt_rejected";
  }

  if (eventName === "llm_live.planner_bridge.created_plan") {
    return "planner_bridge_created_plan";
  }

  const _exhaustive: never = eventName;
  return _exhaustive;
}

function buildEventId(
  event: VerifiedPlannerStructuredEvent,
  sessionId: string,
  eventIdPrefix: string,
): string {
  const traceOrSession = typeof event.traceId === "string" && event.traceId.trim().length > 0
    ? event.traceId.trim()
    : sessionId;

  return eventIdPrefix + ":" + traceOrSession + ":" + mapStructuredEventName(event.event);
}

export function mapVerifiedPlannerStructuredEventToJournalEvent(
  input: VerifiedPlannerObservabilityJournalMappingInput,
): VerifiedPlannerJournalAppendInput {
  const sessionId = readNonEmptyString(input.sessionId, "sessionId");
  const eventIdPrefix = readNonEmptyString(input.eventIdPrefix ?? "verified-planner", "eventIdPrefix");

  return buildVerifiedPlannerJournalEvent({
    eventId: buildEventId(input.event, sessionId, eventIdPrefix),
    sessionId,
    type: mapStructuredEventName(input.event.event),
    traceId: input.event.traceId,
    planId: input.event.planId,
    llmPlanTextFormat: input.event.llmPlanTextFormat,
    promptContractId: input.event.promptContractId,
    promptContractVersion: input.event.promptContractVersion,
    toolNames: input.event.toolNames,
    executable: input.event.executable,
    errorCode: input.event.errorCode,
    issueCount: input.event.issueCount,
    stepCount: input.event.stepCount,
  });
}