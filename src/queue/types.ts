export type AsyncTaskResultStatus = "completed" | "failed";

export interface AsyncTaskError {
  readonly name: string;
  readonly message: string;
}

export interface AsyncTaskContext {
  readonly jobId: string;
  readonly taskType: string;
  readonly enqueuedAtIso: string;
  readonly startedAtIso: string;
  readonly attempt: number;
}

export interface AsyncTaskHandler<Input, Output> {
  readonly taskType: string;
  handle(input: Input, context: AsyncTaskContext): Promise<Output>;
}

export interface EnqueueAsyncTaskOptions {
  readonly jobId?: string;
  readonly enqueuedAtIso?: string;
  readonly startedAtIso?: string;
  readonly completedAtIso?: string;
  readonly attempt?: number;
}

export interface AsyncTaskSuccess<Output> {
  readonly ok: true;
  readonly jobId: string;
  readonly taskType: string;
  readonly status: "completed";
  readonly enqueuedAtIso: string;
  readonly startedAtIso: string;
  readonly completedAtIso: string;
  readonly attempt: number;
  readonly output: Output;
}

export interface AsyncTaskFailure {
  readonly ok: false;
  readonly jobId: string;
  readonly taskType: string;
  readonly status: "failed";
  readonly enqueuedAtIso: string;
  readonly startedAtIso: string;
  readonly completedAtIso: string;
  readonly attempt: number;
  readonly error: AsyncTaskError;
}

export type AsyncTaskResult<Output> = AsyncTaskSuccess<Output> | AsyncTaskFailure;

export interface AsyncTaskQueue {
  enqueue<Input, Output>(
    handler: AsyncTaskHandler<Input, Output>,
    input: Input,
    options?: EnqueueAsyncTaskOptions,
  ): Promise<AsyncTaskResult<Output>>;
}