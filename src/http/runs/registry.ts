import type {
  CreateRunRequest,
  RunRecord,
  RunStatus,
} from "./types";

type TransitionTarget = Exclude<RunStatus, "created">;

function nowIso(): string {
  return new Date().toISOString();
}

function isTerminal(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function canTransition(from: RunStatus, to: TransitionTarget): boolean {
  if (from === "created") {
    return to === "running" || to === "cancelled";
  }

  if (from === "running") {
    return to === "completed" || to === "failed" || to === "cancelled";
  }

  return false;
}

function cloneRun(run: RunRecord): RunRecord {
  return {
    ...run,
    input: run.input ? { ...run.input } : undefined,
    output: run.output ? { ...run.output } : undefined,
    error: run.error ? { ...run.error } : undefined,
  };
}

export class AgentRunRegistry {
  private readonly runs = new Map<string, RunRecord>();
  private nextId = 1;

  create(request: CreateRunRequest): RunRecord {
    const runId = "run_" + String(this.nextId).padStart(6, "0");
    this.nextId += 1;

    const ts = nowIso();
    const record: RunRecord = {
      runId,
      agentId: request.agentId,
      status: "created",
      input: request.input ? { ...request.input } : undefined,
      createdAt: ts,
      updatedAt: ts,
    };

    this.runs.set(runId, record);
    return cloneRun(record);
  }

  get(runId: string): RunRecord | undefined {
    const found = this.runs.get(runId);
    return found ? cloneRun(found) : undefined;
  }

  restore(snapshot: RunRecord): RunRecord {
    if (typeof snapshot.runId !== "string" || snapshot.runId.length === 0) {
      throw new Error("Run not found: " + String(snapshot.runId));
    }

    // restore determinista: aplicamos el snapshot exactamente, sin tocar timestamps.
    this.runs.set(snapshot.runId, {
      ...snapshot,
      input: snapshot.input ? { ...snapshot.input } : undefined,
      output: snapshot.output ? { ...snapshot.output } : undefined,
      error: snapshot.error ? { ...snapshot.error } : undefined,
    });

    return cloneRun(snapshot);
  }

  start(runId: string): RunRecord {
    return this.transition(runId, "running");
  }

  complete(runId: string, output?: Record<string, unknown>): RunRecord {
    const current = this.requireRun(runId);

    if (!canTransition(current.status, "completed")) {
      throw new Error(`Invalid transition: ${current.status} -> completed`);
    }

    const updated: RunRecord = {
      ...current,
      status: "completed",
      output: output ? { ...output } : undefined,
      updatedAt: nowIso(),
    };

    this.runs.set(runId, updated);
    return cloneRun(updated);
  }

  fail(runId: string, code: string, message: string): RunRecord {
    const current = this.requireRun(runId);

    if (!canTransition(current.status, "failed")) {
      throw new Error(`Invalid transition: ${current.status} -> failed`);
    }

    const updated: RunRecord = {
      ...current,
      status: "failed",
      error: { code, message },
      updatedAt: nowIso(),
    };

    this.runs.set(runId, updated);
    return cloneRun(updated);
  }

  cancel(runId: string, reason?: string): RunRecord {
    const current = this.requireRun(runId);

    if (isTerminal(current.status)) {
      throw new Error(`Invalid transition: ${current.status} -> cancelled`);
    }

    if (!canTransition(current.status, "cancelled")) {
      throw new Error(`Invalid transition: ${current.status} -> cancelled`);
    }

    const updated: RunRecord = {
      ...current,
      status: "cancelled",
      error: reason
        ? { code: "RUN_CANCELLED", message: reason }
        : current.error,
      updatedAt: nowIso(),
    };

    this.runs.set(runId, updated);
    return cloneRun(updated);
  }

  private transition(runId: string, next: "running"): RunRecord {
    const current = this.requireRun(runId);

    if (!canTransition(current.status, next)) {
      throw new Error(`Invalid transition: ${current.status} -> ${next}`);
    }

    const updated: RunRecord = {
      ...current,
      status: next,
      updatedAt: nowIso(),
    };

    this.runs.set(runId, updated);
    return cloneRun(updated);
  }

  private requireRun(runId: string): RunRecord {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`Run not found: ${runId}`);
    }
    return current;
  }
}

let singletonRegistry: AgentRunRegistry | undefined;

export function getAgentRunRegistry(): AgentRunRegistry {
  if (!singletonRegistry) {
    singletonRegistry = new AgentRunRegistry();
  }
  return singletonRegistry;
}

export function resetAgentRunRegistryForTests(): void {
  singletonRegistry = undefined;
}
