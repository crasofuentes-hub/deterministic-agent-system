import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVerifiedPlannerJournalEventSink,
  type VerifiedPlannerJournalAppendInput,
  type VerifiedPlannerJournalWriter,
} from "../../src/journal";
import type { VerifiedPlannerStructuredEventEnvelope } from "../../src/agent-run/verified-planner-observability";

function makeEnvelope(
  overrides: Partial<VerifiedPlannerStructuredEventEnvelope>,
): VerifiedPlannerStructuredEventEnvelope {
  return {
    ts: "2026-05-12T00:00:00.000Z",
    subsystem: "llm-live",
    event: "llm_live.planner_prompt.received",
    traceId: "trace-sink-journal-001",
    llmPlanTextFormat: "planner-prompt-output",
    promptContractId: "planner.deterministic",
    promptContractVersion: "1.1.0",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verified planner journal event sink", () => {
  it("maps structured events to journal append events", async () => {
    const events: VerifiedPlannerJournalAppendInput[] = [];

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent(event) {
        events.push(event);
      },
    };

    const sink = createVerifiedPlannerJournalEventSink({
      journal,
      sessionId: "agent-run:trace-sink-journal-001",
    });

    sink(
      makeEnvelope({
        event: "llm_live.planner_prompt.verified",
        traceId: "trace-sink-journal-001",
        planId: "verified-plan-v1",
        toolNames: ["policy.coverage.get", "math/add"],
        executable: true,
      }),
    );

    await Promise.resolve();

    expect(events).toEqual([
      {
        eventId: "verified-planner:trace-sink-journal-001:planner_prompt_verified",
        sessionId: "agent-run:trace-sink-journal-001",
        type: "planner_prompt_verified",
        payload: {
          traceId: "trace-sink-journal-001",
          planId: "verified-plan-v1",
          llmPlanTextFormat: "planner-prompt-output",
          promptContractId: "planner.deterministic",
          promptContractVersion: "1.1.0",
          toolNames: ["math/add", "policy.coverage.get"],
          executable: true,
        },
        metadata: {
          subsystem: "llm-live",
          source: "verified-planner",
        },
      },
    ]);
  });

  it("supports deterministic custom event id prefixes", async () => {
    const events: VerifiedPlannerJournalAppendInput[] = [];

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent(event) {
        events.push(event);
      },
    };

    const sink = createVerifiedPlannerJournalEventSink({
      journal,
      sessionId: "agent-run:trace-sink-journal-002",
      eventIdPrefix: "custom-verified-planner",
    });

    sink(
      makeEnvelope({
        event: "llm_live.planner_bridge.created_plan",
        traceId: "trace-sink-journal-002",
        planId: "verified-plan-v2",
        stepCount: 2,
      }),
    );

    await Promise.resolve();

    expect(events[0]?.eventId).toBe(
      "custom-verified-planner:trace-sink-journal-002:planner_bridge_created_plan",
    );
    expect(events[0]).toMatchObject({
      sessionId: "agent-run:trace-sink-journal-002",
      type: "planner_bridge_created_plan",
      payload: {
        traceId: "trace-sink-journal-002",
        planId: "verified-plan-v2",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        stepCount: 2,
      },
    });
  });

  it("reports async journal append failures through onError", async () => {
    const errors: unknown[] = [];

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent() {
        throw new Error("journal append failed");
      },
    };

    const sink = createVerifiedPlannerJournalEventSink({
      journal,
      sessionId: "agent-run:trace-sink-journal-003",
      onError(error) {
        errors.push(error);
      },
    });

    sink(
      makeEnvelope({
        event: "llm_live.planner_prompt.rejected",
        traceId: "trace-sink-journal-003",
        errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        issueCount: 1,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe("journal append failed");
  });

  it("reports async journal append failures to stderr when onError is omitted", async () => {
    const stderr: string[] = [];

    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      stderr.push(String(chunk));
      return true;
    });

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent() {
        throw new Error("journal append failed");
      },
    };

    const sink = createVerifiedPlannerJournalEventSink({
      journal,
      sessionId: "agent-run:trace-sink-journal-004",
    });

    sink(
      makeEnvelope({
        event: "llm_live.planner_prompt.rejected",
        traceId: "trace-sink-journal-004",
        errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        issueCount: 1,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const errorEvents = stderr
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      subsystem: "llm-live",
      event: "llm_live.planner_journal_sink.error",
      error: "journal append failed",
    });
  });

  it("rejects empty session id and event id prefix", () => {
    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent() {
        return undefined;
      },
    };

    expect(() =>
      createVerifiedPlannerJournalEventSink({
        journal,
        sessionId: "",
      }),
    ).toThrow("sessionId must be a non-empty string");

    expect(() =>
      createVerifiedPlannerJournalEventSink({
        journal,
        sessionId: "agent-run:trace-sink-journal-005",
        eventIdPrefix: "",
      }),
    ).toThrow("eventIdPrefix must be a non-empty string");
  });
});