import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type VerifiedPlannerJournalAppendInput,
  type VerifiedPlannerJournalWriter,
  withVerifiedPlannerJournalEventSink,
  withVerifiedPlannerJournalEventSinkAsync,
} from "../../src/journal";
import {
  clearVerifiedPlannerStructuredEventSink,
  emitVerifiedPlannerStructuredEvent,
} from "../../src/agent-run/verified-planner-observability";

afterEach(() => {
  clearVerifiedPlannerStructuredEventSink();
  vi.restoreAllMocks();
});

function silenceStdout(): void {
  vi.spyOn(process.stdout, "write").mockImplementation((): boolean => true);
}

function createJournalRecorder(): {
  readonly events: VerifiedPlannerJournalAppendInput[];
  readonly journal: VerifiedPlannerJournalWriter;
} {
  const events: VerifiedPlannerJournalAppendInput[] = [];

  return {
    events,
    journal: {
      async appendEvent(event) {
        events.push(event);
      },
    },
  };
}

async function flushAsyncSink(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("scoped verified planner journal sink installer", () => {
  it("installs journal sink only during a synchronous operation", async () => {
    silenceStdout();

    const { events, journal } = createJournalRecorder();

    const result = withVerifiedPlannerJournalEventSink(
      {
        journal,
        sessionId: "agent-run:scope-sync",
      },
      () => {
        emitVerifiedPlannerStructuredEvent({
          event: "llm_live.planner_prompt.received",
          traceId: "scope-sync",
          llmPlanTextFormat: "planner-prompt-output",
          promptContractId: "planner.deterministic",
          promptContractVersion: "1.1.0",
          toolNames: ["math/add"],
        });

        return "operation-result";
      },
    );

    await flushAsyncSink();

    expect(result).toBe("operation-result");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventId: "verified-planner:scope-sync:planner_prompt_received",
      sessionId: "agent-run:scope-sync",
      type: "planner_prompt_received",
      payload: {
        traceId: "scope-sync",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add"],
      },
    });

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.received",
      traceId: "scope-sync-after-restore",
    });

    await flushAsyncSink();

    expect(events).toHaveLength(1);
  });

  it("restores journal sink after a synchronous operation throws", async () => {
    silenceStdout();

    const { events, journal } = createJournalRecorder();

    expect(() =>
      withVerifiedPlannerJournalEventSink(
        {
          journal,
          sessionId: "agent-run:scope-throw",
        },
        () => {
          emitVerifiedPlannerStructuredEvent({
            event: "llm_live.planner_prompt.rejected",
            traceId: "scope-throw",
            llmPlanTextFormat: "planner-prompt-output",
            errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
            issueCount: 1,
          });

          throw new Error("operation failed");
        },
      ),
    ).toThrow("operation failed");

    await flushAsyncSink();

    expect(events).toHaveLength(1);

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.received",
      traceId: "scope-throw-after-restore",
    });

    await flushAsyncSink();

    expect(events).toHaveLength(1);
  });

  it("keeps journal sink installed during an async operation", async () => {
    silenceStdout();

    const { events, journal } = createJournalRecorder();

    const result = await withVerifiedPlannerJournalEventSinkAsync(
      {
        journal,
        sessionId: "agent-run:scope-async",
      },
      async () => {
        emitVerifiedPlannerStructuredEvent({
          event: "llm_live.planner_prompt.received",
          traceId: "scope-async",
          llmPlanTextFormat: "planner-prompt-output",
        });

        await Promise.resolve();

        emitVerifiedPlannerStructuredEvent({
          event: "llm_live.planner_bridge.created_plan",
          traceId: "scope-async",
          planId: "scope-async-plan",
          llmPlanTextFormat: "planner-prompt-output",
          stepCount: 1,
        });

        return 42;
      },
    );

    await flushAsyncSink();

    expect(result).toBe(42);
    expect(events.map((event) => event.type)).toEqual([
      "planner_prompt_received",
      "planner_bridge_created_plan",
    ]);

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.received",
      traceId: "scope-async-after-restore",
    });

    await flushAsyncSink();

    expect(events).toHaveLength(2);
  });

  it("restores journal sink after an async operation rejects", async () => {
    silenceStdout();

    const { events, journal } = createJournalRecorder();

    await expect(
      withVerifiedPlannerJournalEventSinkAsync(
        {
          journal,
          sessionId: "agent-run:scope-async-reject",
        },
        async () => {
          emitVerifiedPlannerStructuredEvent({
            event: "llm_live.planner_prompt.rejected",
            traceId: "scope-async-reject",
            llmPlanTextFormat: "planner-prompt-output",
            errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
            issueCount: 1,
          });

          throw new Error("async operation failed");
        },
      ),
    ).rejects.toThrow("async operation failed");

    await flushAsyncSink();

    expect(events).toHaveLength(1);

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.received",
      traceId: "scope-async-reject-after-restore",
    });

    await flushAsyncSink();

    expect(events).toHaveLength(1);
  });
});