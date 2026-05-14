export type VerifiedPlannerJournalEventType =
  | "planner_prompt_received"
  | "planner_prompt_verified"
  | "planner_prompt_rejected"
  | "planner_bridge_created_plan";

export interface VerifiedPlannerJournalEventInput {
  readonly eventId: string;
  readonly sessionId: string;
  readonly type: VerifiedPlannerJournalEventType;
  readonly traceId?: string;
  readonly tenantId?: string;
  readonly planId?: string;
  readonly llmPlanTextFormat?: "planner-prompt-output";
  readonly promptContractId?: string;
  readonly promptContractVersion?: string;
  readonly toolNames?: readonly string[];
  readonly executable?: boolean;
  readonly errorCode?: string;
  readonly issueCount?: number;
  readonly stepCount?: number;
}

export interface VerifiedPlannerJournalAppendInput {
  readonly eventId: string;
  readonly sessionId: string;
  readonly type: VerifiedPlannerJournalEventType;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface VerifiedPlannerJournalWriter {
  appendEvent(event: VerifiedPlannerJournalAppendInput): Promise<unknown>;
}

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function normalizeToolNames(toolNames: readonly string[] | undefined): readonly string[] | undefined {
  if (typeof toolNames === "undefined") {
    return undefined;
  }

  return [...toolNames]
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

export function buildVerifiedPlannerJournalEvent(
  input: VerifiedPlannerJournalEventInput,
): VerifiedPlannerJournalAppendInput {
  const eventId = readNonEmptyString(input.eventId, "eventId");
  const sessionId = readNonEmptyString(input.sessionId, "sessionId");

  const payload: Record<string, unknown> = {
    traceId: input.traceId,
    tenantId: input.tenantId,
    planId: input.planId,
    llmPlanTextFormat: input.llmPlanTextFormat,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptContractVersion,
    toolNames: normalizeToolNames(input.toolNames),
    executable: input.executable,
    errorCode: input.errorCode,
    issueCount: input.issueCount,
    stepCount: input.stepCount,
  };

  for (const key of Object.keys(payload)) {
    if (typeof payload[key] === "undefined") {
      delete payload[key];
    }
  }

  return {
    eventId,
    sessionId,
    type: input.type,
    payload,
    metadata: {
      subsystem: "llm-live",
      source: "verified-planner",
    },
  };
}

export async function recordVerifiedPlannerJournalEvent(
  journal: VerifiedPlannerJournalWriter,
  input: VerifiedPlannerJournalEventInput,
): Promise<void> {
  await journal.appendEvent(buildVerifiedPlannerJournalEvent(input));
}