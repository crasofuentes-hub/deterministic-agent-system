import type { AgentRunInput } from "../../agent-run/types";
import {
  withVerifiedPlannerJournalEventSinkAsync,
  type VerifiedPlannerJournalEventSinkOptions,
  type VerifiedPlannerJournalWriter,
} from "../../journal";

export interface AgentRunVerifiedPlannerJournalOptions {
  readonly journal?: VerifiedPlannerJournalWriter;
  readonly sessionId?: string;
  readonly eventIdPrefix?: string;
  readonly onError?: (error: unknown) => void;
}

export interface AgentRunHandlerOptions extends AgentRunVerifiedPlannerJournalOptions {
  readonly verifiedPlannerJournalSinkInstalled?: boolean;
}

export function shouldInstallVerifiedPlannerJournalSink(input: AgentRunInput): boolean {
  return input.planner === "llm-live" && input.llmPlanTextFormat === "planner-prompt-output";
}

export function buildAgentRunVerifiedPlannerJournalSessionId(input: AgentRunInput): string {
  if (typeof input.traceId === "string" && input.traceId.trim().length > 0) {
    return "agent-run:" + input.traceId.trim();
  }

  if (typeof input.llmVerifiedPlanId === "string" && input.llmVerifiedPlanId.trim().length > 0) {
    return "agent-run:" + input.llmVerifiedPlanId.trim();
  }

  return "agent-run:verified-planner";
}

export async function withOptionalAgentRunVerifiedPlannerJournalSink<T>(
  input: AgentRunInput,
  options: AgentRunHandlerOptions,
  operation: () => Promise<T>,
): Promise<T> {
  if (
    options.verifiedPlannerJournalSinkInstalled === true ||
    typeof options.journal === "undefined" ||
    !shouldInstallVerifiedPlannerJournalSink(input)
  ) {
    return operation();
  }

  const sinkOptions: VerifiedPlannerJournalEventSinkOptions = {
    journal: options.journal,
    sessionId: options.sessionId ?? buildAgentRunVerifiedPlannerJournalSessionId(input),
    eventIdPrefix: options.eventIdPrefix,
    onError: options.onError,
  };

  return withVerifiedPlannerJournalEventSinkAsync(sinkOptions, operation);
}