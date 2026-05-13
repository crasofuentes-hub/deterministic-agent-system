import { describe, expect, it } from "vitest";
import { createInlineAsyncTaskQueue } from "../../src/queue";
import { runAgentThroughInlineTaskQueue, runAgentThroughQueue } from "../../src/agent-run";
import type { AgentRunInput, Planner } from "../../src/agent-run";

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

function makeComputePlanner(): Planner {
  return {
    plan(input) {
      return {
        planId: "queued-agent-run-plan-v1",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: input.goal },
          { id: "b", kind: "set", key: "intent", value: "compute" },
          { id: "c", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
          { id: "d", kind: "append_log", value: "done" },
        ],
      };
    },
  };
}

function makeInvalidPlanPlanner(): Planner {
  return {
    plan() {
      return {
        planId: "queued-agent-run-invalid-plan-v1",
        version: 1,
        steps: [
          { id: "a", kind: "tool.call", toolId: "missing/tool", input: {}, outputKey: "missing" },
        ],
      };
    },
  };
}

describe("agent run queue integration", () => {
  it("routes a real agent run through the inline async task queue", async () => {
    const result = await runAgentThroughInlineTaskQueue({
      input: makeInput(),
      planner: makeComputePlanner(),
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

    expect(result.result.planId).toBe("queued-agent-run-plan-v1");
    expect(result.result.finalState.values.sum).toBe("{\"sum\":5}");
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
      planner: makeComputePlanner(),
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
        traceId: "trace-agent-run-queue-invalid-001",
      }),
      planner: makeInvalidPlanPlanner(),
      enqueueOptions: {
        jobId: "agent-run:trace-agent-run-queue-invalid-001",
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected queued agent run to fail deterministically");
    }

    expect(result.error.retryable).toBe(false);
  });

  it("throws only when the queue infrastructure itself fails", async () => {
    await expect(
      runAgentThroughQueue({
        input: makeInput({
          traceId: "trace-agent-run-queue-infra-fail-001",
        }),
        planner: makeComputePlanner(),
        queue: {
          async enqueue() {
            return {
              ok: false,
              jobId: "agent-run:trace-agent-run-queue-infra-fail-001",
              taskType: "agent.run",
              status: "failed",
              enqueuedAtIso: "2026-05-13T02:00:00.000Z",
              startedAtIso: "2026-05-13T02:00:01.000Z",
              completedAtIso: "2026-05-13T02:00:02.000Z",
              attempt: 1,
              error: {
                name: "QueueInfrastructureError",
                message: "queue infrastructure failed",
              },
            };
          },
        },
      }),
    ).rejects.toThrow("agent_run_queue_failed: queue infrastructure failed");
  });
});