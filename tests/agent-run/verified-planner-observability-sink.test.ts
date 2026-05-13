import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearVerifiedPlannerStructuredEventSink,
  emitVerifiedPlannerStructuredEvent,
  normalizeVerifiedPlannerToolNames,
  setVerifiedPlannerStructuredEventSink,
  type VerifiedPlannerStructuredEventEnvelope,
} from "../../src/agent-run/verified-planner-observability";

function captureStdout(): string[] {
  const writes: string[] = [];

  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
    writes.push(String(chunk));
    return true;
  });

  return writes;
}

function captureStderr(): string[] {
  const writes: string[] = [];

  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
    writes.push(String(chunk));
    return true;
  });

  return writes;
}

afterEach(() => {
  clearVerifiedPlannerStructuredEventSink();
  vi.restoreAllMocks();
});

describe("verified planner observability sink hook", () => {
  it("emits to stdout and the configured sink", () => {
    const stdout = captureStdout();
    const sinkEvents: VerifiedPlannerStructuredEventEnvelope[] = [];

    setVerifiedPlannerStructuredEventSink((event) => {
      sinkEvents.push(event);
    });

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.received",
      traceId: "trace-sink-001",
      llmPlanTextFormat: "planner-prompt-output",
      promptContractId: "planner.deterministic",
      promptContractVersion: "1.1.0",
      toolNames: ["math/add"],
    });

    const stdoutEvents = stdout
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as VerifiedPlannerStructuredEventEnvelope);

    expect(stdoutEvents).toHaveLength(1);
    expect(stdoutEvents[0]).toMatchObject({
      subsystem: "llm-live",
      event: "llm_live.planner_prompt.received",
      traceId: "trace-sink-001",
      llmPlanTextFormat: "planner-prompt-output",
      promptContractId: "planner.deterministic",
      promptContractVersion: "1.1.0",
      toolNames: ["math/add"],
    });
    expect(typeof stdoutEvents[0].ts).toBe("string");

    expect(sinkEvents).toEqual(stdoutEvents);
  });

  it("restore function resets the previous sink", () => {
    captureStdout();

    const firstSinkEvents: VerifiedPlannerStructuredEventEnvelope[] = [];
    const secondSinkEvents: VerifiedPlannerStructuredEventEnvelope[] = [];

    const restoreFirst = setVerifiedPlannerStructuredEventSink((event) => {
      firstSinkEvents.push(event);
    });

    const restoreSecond = setVerifiedPlannerStructuredEventSink((event) => {
      secondSinkEvents.push(event);
    });

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.verified",
      traceId: "trace-sink-002",
    });

    restoreSecond();

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_bridge.created_plan",
      traceId: "trace-sink-003",
    });

    restoreFirst();

    emitVerifiedPlannerStructuredEvent({
      event: "llm_live.planner_prompt.rejected",
      traceId: "trace-sink-004",
    });

    expect(secondSinkEvents.map((event) => event.traceId)).toEqual(["trace-sink-002"]);
    expect(firstSinkEvents.map((event) => event.traceId)).toEqual(["trace-sink-003"]);
  });

  it("does not let sink failures break the runtime path", () => {
    captureStdout();
    const stderr = captureStderr();

    setVerifiedPlannerStructuredEventSink(() => {
      throw new Error("sink failed");
    });

    expect(() =>
      emitVerifiedPlannerStructuredEvent({
        event: "llm_live.planner_prompt.rejected",
        traceId: "trace-sink-failure",
        errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
      }),
    ).not.toThrow();

    const errorEvents = stderr
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      subsystem: "llm-live",
      event: "llm_live.planner_event_sink.error",
      error: "sink failed",
    });
  });

  it("normalizes tool names deterministically", () => {
    expect(
      normalizeVerifiedPlannerToolNames([
        { name: "policy.coverage.get" },
        { name: "" },
        { name: " math/add " },
        { name: null },
        {},
      ]),
    ).toEqual(["math/add", "policy.coverage.get"]);
  });
});