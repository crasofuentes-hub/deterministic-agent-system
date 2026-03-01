import type { RunRecord } from "../http/runs/types";

export interface CheckpointStore {
  saveValid(runId: string, snapshot: RunRecord): void;
  loadLatestValid(runId: string): RunRecord | undefined;
}

export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly latest = new Map<string, RunRecord>();

  saveValid(runId: string, snapshot: RunRecord): void {
    // Guardamos copia para evitar mutaciones laterales.
    this.latest.set(runId, {
      ...snapshot,
      input: snapshot.input ? { ...snapshot.input } : undefined,
      output: snapshot.output ? { ...snapshot.output } : undefined,
      error: snapshot.error ? { ...snapshot.error } : undefined,
    });
  }

  loadLatestValid(runId: string): RunRecord | undefined {
    const found = this.latest.get(runId);
    if (!found) return undefined;

    return {
      ...found,
      input: found.input ? { ...found.input } : undefined,
      output: found.output ? { ...found.output } : undefined,
      error: found.error ? { ...found.error } : undefined,
    };
  }
}

// Singleton de proceso (suficiente para integración actual HTTP).
let singletonStore: InMemoryCheckpointStore | undefined;

export function getCheckpointStore(): InMemoryCheckpointStore {
  if (!singletonStore) singletonStore = new InMemoryCheckpointStore();
  return singletonStore;
}

export function resetCheckpointStoreForTests(): void {
  singletonStore = undefined;
}
