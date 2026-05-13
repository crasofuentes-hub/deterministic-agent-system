import { createInlineAsyncTaskQueue, type AsyncTaskQueue, type EnqueueAsyncTaskOptions } from "../queue";
import { runAgent } from "./run";
import type { AgentRunInput } from "./types";

export type QueuedAgentRunResult = Awaited<ReturnType<typeof runAgent>>;

export interface RunAgentThroughQueueInput {
  readonly input: AgentRunInput;
  readonly queue: AsyncTaskQueue;
  readonly enqueueOptions?: EnqueueAsyncTaskOptions;
}

export interface RunAgentThroughInlineQueueInput {
  readonly input: AgentRunInput;
  readonly enqueueOptions?: EnqueueAsyncTaskOptions;
  readonly defaultEnqueuedAtIso?: string;
}

function readNonEmptyString(value: string | undefined, fallback: string, name: string): string {
  const selected = typeof value === "string" ? value : fallback;
  const normalized = selected.trim();

  if (normalized.length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

export async function runAgentThroughQueue(
  params: RunAgentThroughQueueInput,
): Promise<QueuedAgentRunResult> {
  const queueResult = await params.queue.enqueue<AgentRunInput, QueuedAgentRunResult>(
    async (input) => runAgent(input),
    params.input,
    {
      jobId: readNonEmptyString(
        params.enqueueOptions?.jobId,
        "agent-run:" + params.input.traceId,
        "jobId",
      ),
      enqueuedAtIso: params.enqueueOptions?.enqueuedAtIso,
      startedAtIso: params.enqueueOptions?.startedAtIso,
      completedAtIso: params.enqueueOptions?.completedAtIso,
      attempt: params.enqueueOptions?.attempt,
    },
  );

  if (!queueResult.ok) {
    throw new Error("agent_run_queue_failed: " + queueResult.error.message);
  }

  return queueResult.output;
}

export async function runAgentThroughInlineTaskQueue(
  params: RunAgentThroughInlineQueueInput,
): Promise<QueuedAgentRunResult> {
  const queue = createInlineAsyncTaskQueue({
    defaultEnqueuedAtIso: params.defaultEnqueuedAtIso,
  });

  return runAgentThroughQueue({
    input: params.input,
    queue,
    enqueueOptions: params.enqueueOptions,
  });
}