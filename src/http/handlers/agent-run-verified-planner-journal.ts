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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBodyString(body: unknown, key: string): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const value = body[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
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

export function buildAgentRunVerifiedPlannerJournalSessionIdFromBody(body: unknown): string {
  const traceId = readBodyString(body, "traceId");

  if (typeof traceId === "string") {
    return "agent-run:" + traceId;
  }

  const verifiedPlanId = readBodyString(body, "llmVerifiedPlanId");

  if (typeof verifiedPlanId === "string") {
    return "agent-run:" + verifiedPlanId;
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
    typeof options.journal === "undefined"
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

export async function withOptionalAgentRunVerifiedPlannerJournalSinkFromBody<T>(
  body: unknown,
  options: AgentRunHandlerOptions,
  operation: () => Promise<T>,
): Promise<T> {
  if (
    options.verifiedPlannerJournalSinkInstalled === true ||
    typeof options.journal === "undefined"
  ) {
    return operation();
  }

  const sinkOptions: VerifiedPlannerJournalEventSinkOptions = {
    journal: options.journal,
    sessionId: options.sessionId ?? buildAgentRunVerifiedPlannerJournalSessionIdFromBody(body),
    eventIdPrefix: options.eventIdPrefix,
    onError: options.onError,
  };

  return withVerifiedPlannerJournalEventSinkAsync(sinkOptions, operation);
}