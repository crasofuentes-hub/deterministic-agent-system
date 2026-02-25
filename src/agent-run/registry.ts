import type {
  AgentRunRecord,
  AgentRunRegistry,
  CreateAgentRunInput,
  FailAgentRunInput,
  StartAgentRunInput,
  SucceedAgentRunInput,
} from "./types";

function cloneRecord(record: AgentRunRecord): AgentRunRecord {
  return JSON.parse(JSON.stringify(record)) as AgentRunRecord;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertIsoTimestamp(value: string, field: string): void {
  if (!isNonEmptyString(value)) {
    throw new Error(field + " must be a non-empty string");
  }

  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    throw new Error(field + " must be a valid ISO timestamp");
  }
}

function assertStatusTransition(current: AgentRunRecord, next: "running" | "succeeded" | "failed"): void {
  if (next === "running") {
    if (current.status !== "created") {
      throw new Error("Invalid transition to running from " + current.status);
    }
    return;
  }

  if (next === "succeeded" || next === "failed") {
    if (current.status !== "running") {
      throw new Error("Invalid transition to " + next + " from " + current.status);
    }
  }
}

function compareRecordsStable(a: AgentRunRecord, b: AgentRunRecord): number {
  if (a.timestamps.createdAt < b.timestamps.createdAt) return -1;
  if (a.timestamps.createdAt > b.timestamps.createdAt) return 1;
  if (a.runId < b.runId) return -1;
  if (a.runId > b.runId) return 1;
  return 0;
}

export class InMemoryAgentRunRegistry implements AgentRunRegistry {
  private readonly runs = new Map<string, AgentRunRecord>();

  create(input: CreateAgentRunInput): AgentRunRecord {
    if (!isNonEmptyString(input.runId)) {
      throw new Error("runId must be a non-empty string");
    }
    if (!isNonEmptyString(input.agentId)) {
      throw new Error("agentId must be a non-empty string");
    }
    assertIsoTimestamp(input.createdAt, "createdAt");

    if (!Number.isInteger(input.traceSchemaVersion) || input.traceSchemaVersion <= 0) {
      throw new Error("traceSchemaVersion must be a positive integer");
    }

    if (this.runs.has(input.runId)) {
      throw new Error("runId already exists: " + input.runId);
    }

    const record: AgentRunRecord = {
      runId: input.runId,
      agentId: input.agentId,
      requestId: input.requestId,
      status: "created",
      timestamps: {
        createdAt: input.createdAt,
      },
      determinism: {
        traceSchemaVersion: input.traceSchemaVersion,
      },
      metadata: input.metadata ? { ...input.metadata } : {},
    };

    this.runs.set(record.runId, record);
    return cloneRecord(record);
  }

  start(input: StartAgentRunInput): AgentRunRecord {
    if (!isNonEmptyString(input.runId)) {
      throw new Error("runId must be a non-empty string");
    }
    assertIsoTimestamp(input.startedAt, "startedAt");

    const current = this.runs.get(input.runId);
    if (!current) {
      throw new Error("runId not found: " + input.runId);
    }

    assertStatusTransition(current, "running");

    const next: AgentRunRecord = {
      ...current,
      timestamps: {
        ...current.timestamps,
        startedAt: input.startedAt,
      },
      status: "running",
    };

    this.runs.set(next.runId, next);
    return cloneRecord(next);
  }

  succeed(input: SucceedAgentRunInput): AgentRunRecord {
    if (!isNonEmptyString(input.runId)) {
      throw new Error("runId must be a non-empty string");
    }
    assertIsoTimestamp(input.finishedAt, "finishedAt");

    if (!isNonEmptyString(input.planHash)) {
      throw new Error("planHash must be a non-empty string");
    }
    if (!isNonEmptyString(input.executionHash)) {
      throw new Error("executionHash must be a non-empty string");
    }
    if (!isNonEmptyString(input.finalTraceLinkHash)) {
      throw new Error("finalTraceLinkHash must be a non-empty string");
    }

    const current = this.runs.get(input.runId);
    if (!current) {
      throw new Error("runId not found: " + input.runId);
    }

    assertStatusTransition(current, "succeeded");

    const next: AgentRunRecord = {
      ...current,
      status: "succeeded",
      timestamps: {
        ...current.timestamps,
        finishedAt: input.finishedAt,
      },
      determinism: {
        ...current.determinism,
        planHash: input.planHash,
        executionHash: input.executionHash,
        finalTraceLinkHash: input.finalTraceLinkHash,
      },
      error: undefined,
    };

    this.runs.set(next.runId, next);
    return cloneRecord(next);
  }

  fail(input: FailAgentRunInput): AgentRunRecord {
    if (!isNonEmptyString(input.runId)) {
      throw new Error("runId must be a non-empty string");
    }
    assertIsoTimestamp(input.finishedAt, "finishedAt");

    if (!input.error || !isNonEmptyString(input.error.code) || !isNonEmptyString(input.error.message)) {
      throw new Error("error must contain non-empty code and message");
    }

    const current = this.runs.get(input.runId);
    if (!current) {
      throw new Error("runId not found: " + input.runId);
    }

    assertStatusTransition(current, "failed");

    const next: AgentRunRecord = {
      ...current,
      status: "failed",
      timestamps: {
        ...current.timestamps,
        finishedAt: input.finishedAt,
      },
      determinism: {
        ...current.determinism,
        planHash: input.planHash ?? current.determinism.planHash,
        executionHash: input.executionHash ?? current.determinism.executionHash,
        finalTraceLinkHash: input.finalTraceLinkHash ?? current.determinism.finalTraceLinkHash,
      },
      error: {
        code: input.error.code,
        message: input.error.message,
      },
    };

    this.runs.set(next.runId, next);
    return cloneRecord(next);
  }

  get(runId: string): AgentRunRecord | undefined {
    const found = this.runs.get(runId);
    return found ? cloneRecord(found) : undefined;
  }

  list(): AgentRunRecord[] {
    const items: AgentRunRecord[] = [];
    for (const value of this.runs.values()) {
      items.push(cloneRecord(value));
    }
    items.sort(compareRecordsStable);
    return items;
  }
}