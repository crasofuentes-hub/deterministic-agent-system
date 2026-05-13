import { describe, expect, it } from "vitest";
import { createInlineAsyncTaskQueue } from "../../src/queue";
import { runAgentThroughInlineTaskQueue, runAgentThroughQueue } from "../../src/agent-run";
import type { AgentRunInput } from "../../src/agent-run";

function makeInput(overrides: Partial<AgentRunInput> = {}): AgentRunInput {
  return {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    planner: "mock",
    maxSteps: 8,
    traceId: "trace-agent-run-queue-001",
    ...overrides,
  };
}

describe("agent run queue integration", () => {
  it("routes a real agent run through the inline async task queue", async () => {
    const result = await runAgentThroughInlineTaskQueue({
      input: makeInput(),
      defaultEnqueuedAtIso: "2026-05-13T00:00:00.000Z",
      enqueueOptions: {
        jobId: "agent-run:trace-agent-run-queue-001",
        enqueuedAtIso: "2026-05-13T00:00:01.000Z",
        startedAtIso: "2026-05-13T00:00:02.000Z",
        completedAtIso: "2026-05-13T00:00:03.000Z",
      },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected queued agent run to succeed");
    }

    expect(result.result.planHash).toEqual(expect.any(String));
    expect(result.result.executionHash).toEqual(expect.any(String));
    expect(result.result.finalTraceLinkHash).toEqual(expect.any(String));
  });

  it("supports dependency injection of an explicit async task queue", async () => {
    const queue = createInlineAsyncTaskQueue({
      defaultEnqueuedAtIso: "2026-05-13T01:00:00.000Z",
    });

    const result = await runAgentThroughQueue({
      input: makeInput({
        traceId: "trace-agent-run-queue-002",
      }),
      queue,
      enqueueOptions: {
        jobId: "agent-run:trace-agent-run-queue-002",
      },
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected queued agent run to succeed");
    }

    expect(result.result.planHash).toEqual(expect.any(String));
  });

  it("preserves deterministic agent run failures through the queue wrapper", async () => {
    const result = await runAgentThroughInlineTaskQueue({
      input: makeInput({
        planner: "llm-live",
        llmProvider: "openai-compatible",
        llmPlanText: JSON.stringify({
          invalid: true,
        }),
        traceId: "trace-agent-run-queue-invalid-001",
      }),
      enqueueOptions: {
        jobId: "agent-run:trace-agent-run-queue-invalid-001",
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected queued agent run to fail deterministically");
    }

    expect(result.error.code).toBe("LLM_LIVE_INVALID_PLAN_TEXT");
    expect(result.error.retryable).toBe(false);
  });

  it("throws only when the queue infrastructure itself fails", async () => {
    await expect(
      runAgentThroughQueue({
        input: makeInput({
          traceId: "trace-agent-run-queue-infra-fail-001",
        }),
        queue: {
          async enqueue() {
            return {
              ok: false,
              jobId: "agent-run:trace-agent-run-queue-infra-fail-001",
              status: "failed",
              enqueuedAtIso: "2026-05-13T02:00:00.000Z",
              startedAtIso: "2026-05-13T02:00:01.000Z",
              completedAtIso: "2026-05-13T02:00:02.000Z",
              attempt: 1,
              error: {
                message: "queue infrastructure failed",
              },
            };
          },
        },
      }),
    ).rejects.toThrow("agent_run_queue_failed: queue infrastructure failed");
  });
});