import {
  createInlineAsyncTaskQueue,
  type AsyncTaskContext,
  type AsyncTaskHandler,
  type AsyncTaskQueue,
  type EnqueueAsyncTaskOptions,
} from "../queue";
import { runAgent } from "./run";
import type { AgentRunInput, Planner } from "./types";

export type QueuedAgentRunResult = Awaited<ReturnType<typeof runAgent>>;

interface QueuedAgentRunTaskInput {
  readonly input: AgentRunInput;
  readonly planner: Planner;
}

export interface RunAgentThroughQueueInput {
  readonly input: AgentRunInput;
  readonly planner: Planner;
  readonly queue: AsyncTaskQueue;
  readonly enqueueOptions?: EnqueueAsyncTaskOptions;
}

export interface RunAgentThroughInlineQueueInput {
  readonly input: AgentRunInput;
  readonly planner: Planner;
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

function createAgentRunQueueHandler(): AsyncTaskHandler<
  QueuedAgentRunTaskInput,
  QueuedAgentRunResult
> {
  return {
    taskType: "agent.run",

    async handle(
      taskInput: QueuedAgentRunTaskInput,
      _context: AsyncTaskContext,
    ): Promise<QueuedAgentRunResult> {
      return runAgent(taskInput.input, taskInput.planner);
    },
  };
}

export async function runAgentThroughQueue(
  params: RunAgentThroughQueueInput,
): Promise<QueuedAgentRunResult> {
  const queueResult = await params.queue.enqueue<QueuedAgentRunTaskInput, QueuedAgentRunResult>(
    createAgentRunQueueHandler(),
    {
      input: params.input,
      planner: params.planner,
    },
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
    planner: params.planner,
    queue,
    enqueueOptions: params.enqueueOptions,
  });
}