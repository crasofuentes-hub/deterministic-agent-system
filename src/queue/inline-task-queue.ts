import type {
  AsyncTaskContext,
  AsyncTaskHandler,
  AsyncTaskQueue,
  AsyncTaskResult,
  EnqueueAsyncTaskOptions,
} from "./types";

const DEFAULT_TIMESTAMP_ISO = "2026-03-24T00:00:00.000Z";

export interface InlineAsyncTaskQueueOptions {
  readonly jobIdPrefix?: string;
  readonly defaultEnqueuedAtIso?: string;
  readonly defaultStartedAtIso?: string;
  readonly defaultCompletedAtIso?: string;
}

function readNonEmptyString(value: string | undefined, fallback: string, name: string): string {
  const normalized = value?.trim() ?? fallback;

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function readPositiveInteger(value: number | undefined, fallback: number, name: string): number {
  const normalized = value ?? fallback;

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(name + " must be a positive integer");
  }

  return normalized;
}

function normalizeTaskType(taskType: string): string {
  const normalized = taskType.trim();

  if (!normalized) {
    throw new Error("taskType must be a non-empty string");
  }

  return normalized;
}

function normalizeError(error: unknown): { readonly name: string; readonly message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

export function createInlineAsyncTaskQueue(
  options: InlineAsyncTaskQueueOptions = {},
): AsyncTaskQueue {
  const jobIdPrefix = readNonEmptyString(options.jobIdPrefix, "inline-job", "jobIdPrefix");
  const defaultEnqueuedAtIso = readNonEmptyString(
    options.defaultEnqueuedAtIso,
    DEFAULT_TIMESTAMP_ISO,
    "defaultEnqueuedAtIso",
  );
  const defaultStartedAtIso = readNonEmptyString(
    options.defaultStartedAtIso,
    DEFAULT_TIMESTAMP_ISO,
    "defaultStartedAtIso",
  );
  const defaultCompletedAtIso = readNonEmptyString(
    options.defaultCompletedAtIso,
    DEFAULT_TIMESTAMP_ISO,
    "defaultCompletedAtIso",
  );

  let nextSequence = 1;

  return {
    async enqueue<Input, Output>(
      handler: AsyncTaskHandler<Input, Output>,
      input: Input,
      enqueueOptions: EnqueueAsyncTaskOptions = {},
    ): Promise<AsyncTaskResult<Output>> {
      const taskType = normalizeTaskType(handler.taskType);
      const sequence = String(nextSequence).padStart(6, "0");
      nextSequence += 1;

      const jobId = readNonEmptyString(
        enqueueOptions.jobId,
        jobIdPrefix + ":" + taskType + ":" + sequence,
        "jobId",
      );

      const enqueuedAtIso = readNonEmptyString(
        enqueueOptions.enqueuedAtIso,
        defaultEnqueuedAtIso,
        "enqueuedAtIso",
      );
      const startedAtIso = readNonEmptyString(
        enqueueOptions.startedAtIso,
        defaultStartedAtIso,
        "startedAtIso",
      );
      const completedAtIso = readNonEmptyString(
        enqueueOptions.completedAtIso,
        defaultCompletedAtIso,
        "completedAtIso",
      );
      const attempt = readPositiveInteger(enqueueOptions.attempt, 1, "attempt");

      const context: AsyncTaskContext = {
        jobId,
        taskType,
        enqueuedAtIso,
        startedAtIso,
        attempt,
      };

      try {
        const output = await handler.handle(input, context);

        return {
          ok: true,
          jobId,
          taskType,
          status: "completed",
          enqueuedAtIso,
          startedAtIso,
          completedAtIso,
          attempt,
          output,
        };
      } catch (error) {
        return {
          ok: false,
          jobId,
          taskType,
          status: "failed",
          enqueuedAtIso,
          startedAtIso,
          completedAtIso,
          attempt,
          error: normalizeError(error),
        };
      }
    },
  };
}