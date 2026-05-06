import { describe, expect, it } from "vitest";
import {
  createInlineAsyncTaskQueue,
  type AsyncTaskHandler,
} from "../../src/queue";

describe("inline async task queue", () => {
  it("executes a task inline and returns deterministic metadata", async () => {
    const queue = createInlineAsyncTaskQueue({
      jobIdPrefix: "test-job",
      defaultEnqueuedAtIso: "2026-05-06T00:00:00.000Z",
      defaultStartedAtIso: "2026-05-06T00:00:01.000Z",
      defaultCompletedAtIso: "2026-05-06T00:00:02.000Z",
    });

    const handler: AsyncTaskHandler<{ readonly left: number; readonly right: number }, number> = {
      taskType: "math.add",
      async handle(input, context) {
        expect(context).toEqual({
          jobId: "test-job:math.add:000001",
          taskType: "math.add",
          enqueuedAtIso: "2026-05-06T00:00:00.000Z",
          startedAtIso: "2026-05-06T00:00:01.000Z",
          attempt: 1,
        });

        return input.left + input.right;
      },
    };

    await expect(queue.enqueue(handler, { left: 2, right: 3 })).resolves.toEqual({
      ok: true,
      jobId: "test-job:math.add:000001",
      taskType: "math.add",
      status: "completed",
      enqueuedAtIso: "2026-05-06T00:00:00.000Z",
      startedAtIso: "2026-05-06T00:00:01.000Z",
      completedAtIso: "2026-05-06T00:00:02.000Z",
      attempt: 1,
      output: 5,
    });
  });

  it("supports explicit deterministic enqueue metadata", async () => {
    const queue = createInlineAsyncTaskQueue();

    const handler: AsyncTaskHandler<{ readonly value: string }, string> = {
      taskType: "text.uppercase",
      async handle(input) {
        return input.value.toUpperCase();
      },
    };

    await expect(
      queue.enqueue(
        handler,
        { value: "agent" },
        {
          jobId: "job-explicit-001",
          enqueuedAtIso: "2026-05-06T01:00:00.000Z",
          startedAtIso: "2026-05-06T01:00:01.000Z",
          completedAtIso: "2026-05-06T01:00:02.000Z",
          attempt: 2,
        },
      ),
    ).resolves.toEqual({
      ok: true,
      jobId: "job-explicit-001",
      taskType: "text.uppercase",
      status: "completed",
      enqueuedAtIso: "2026-05-06T01:00:00.000Z",
      startedAtIso: "2026-05-06T01:00:01.000Z",
      completedAtIso: "2026-05-06T01:00:02.000Z",
      attempt: 2,
      output: "AGENT",
    });
  });

  it("returns deterministic failure results instead of throwing task errors", async () => {
    const queue = createInlineAsyncTaskQueue({
      defaultEnqueuedAtIso: "2026-05-06T02:00:00.000Z",
      defaultStartedAtIso: "2026-05-06T02:00:01.000Z",
      defaultCompletedAtIso: "2026-05-06T02:00:02.000Z",
    });

    const handler: AsyncTaskHandler<{ readonly value: string }, string> = {
      taskType: "task.fail",
      async handle() {
        throw new TypeError("deterministic failure");
      },
    };

    await expect(queue.enqueue(handler, { value: "x" })).resolves.toEqual({
      ok: false,
      jobId: "inline-job:task.fail:000001",
      taskType: "task.fail",
      status: "failed",
      enqueuedAtIso: "2026-05-06T02:00:00.000Z",
      startedAtIso: "2026-05-06T02:00:01.000Z",
      completedAtIso: "2026-05-06T02:00:02.000Z",
      attempt: 1,
      error: {
        name: "TypeError",
        message: "deterministic failure",
      },
    });
  });

  it("rejects invalid queue metadata deterministically", async () => {
    const queue = createInlineAsyncTaskQueue();

    const handler: AsyncTaskHandler<undefined, undefined> = {
      taskType: " ",
      async handle() {
        return undefined;
      },
    };

    await expect(queue.enqueue(handler, undefined)).rejects.toThrow(
      "taskType must be a non-empty string",
    );

    const validHandler: AsyncTaskHandler<undefined, undefined> = {
      taskType: "valid.task",
      async handle() {
        return undefined;
      },
    };

    await expect(queue.enqueue(validHandler, undefined, { attempt: 0 })).rejects.toThrow(
      "attempt must be a positive integer",
    );
  });
});