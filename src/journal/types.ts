export type JournalEventType =
  | "plan"
  | "tool_call"
  | "tool_result"
  | "llm_response"
  | "message_received"
  | "message_processed"
  | "handoff"
  | "error"
  | "convergence";

export interface AppendJournalEventInput {
  readonly eventId: string;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly type: JournalEventType;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface StoredJournalEvent extends AppendJournalEventInput {
  readonly sequence: number;
  readonly hashPrev: string | null;
  readonly hashSelf: string;
}

export interface GetSessionJournalOptions {
  readonly integrityCheck?: boolean;
}

export interface SessionJournal {
  readonly sessionId: string;
  readonly events: readonly StoredJournalEvent[];
  readonly integrityOk?: boolean;
}

export interface ExecutionJournal {
  appendEvent(event: AppendJournalEventInput): Promise<StoredJournalEvent>;

  verifyChain(sessionId: string): Promise<boolean>;

  getSessionJournal(
    sessionId: string,
    options?: GetSessionJournalOptions,
  ): Promise<SessionJournal>;
}