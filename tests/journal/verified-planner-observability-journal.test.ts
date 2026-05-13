import { describe, expect, it } from "vitest";
import { mapVerifiedPlannerStructuredEventToJournalEvent } from "../../src/journal";

describe("verified planner observability to journal mapper", () => {
  it("maps received structured event to journal metadata event", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:trace-001",
      event: {
        event: "llm_live.planner_prompt.received",
        traceId: "trace-001",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["policy.coverage.get", "math/add"],
      },
    });

    expect(event).toEqual({
      eventId: "verified-planner:trace-001:planner_prompt_received",
      sessionId: "agent-run:trace-001",
      type: "planner_prompt_received",
      payload: {
        traceId: "trace-001",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add", "policy.coverage.get"],
      },
      metadata: {
        subsystem: "llm-live",
        source: "verified-planner",
      },
    });
  });

  it("maps verified structured event to journal metadata event", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:trace-002",
      event: {
        event: "llm_live.planner_prompt.verified",
        traceId: "trace-002",
        planId: "verified-plan-v1",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add"],
        executable: true,
      },
    });

    expect(event).toMatchObject({
      eventId: "verified-planner:trace-002:planner_prompt_verified",
      sessionId: "agent-run:trace-002",
      type: "planner_prompt_verified",
      payload: {
        traceId: "trace-002",
        planId: "verified-plan-v1",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add"],
        executable: true,
      },
    });
  });

  it("maps rejected structured event to journal metadata event", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:trace-003",
      event: {
        event: "llm_live.planner_prompt.rejected",
        traceId: "trace-003",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        issueCount: 1,
      },
    });

    expect(event).toEqual({
      eventId: "verified-planner:trace-003:planner_prompt_rejected",
      sessionId: "agent-run:trace-003",
      type: "planner_prompt_rejected",
      payload: {
        traceId: "trace-003",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
        issueCount: 1,
      },
      metadata: {
        subsystem: "llm-live",
        source: "verified-planner",
      },
    });
  });

  it("maps bridge created structured event to journal metadata event", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:trace-004",
      event: {
        event: "llm_live.planner_bridge.created_plan",
        traceId: "trace-004",
        planId: "verified-plan-v1",
        llmPlanTextFormat: "planner-prompt-output",
        stepCount: 2,
      },
    });

    expect(event).toMatchObject({
      eventId: "verified-planner:trace-004:planner_bridge_created_plan",
      sessionId: "agent-run:trace-004",
      type: "planner_bridge_created_plan",
      payload: {
        traceId: "trace-004",
        planId: "verified-plan-v1",
        llmPlanTextFormat: "planner-prompt-output",
        stepCount: 2,
      },
    });
  });

  it("uses session id when trace id is absent", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:no-trace",
      event: {
        event: "llm_live.planner_prompt.received",
      },
    });

    expect(event.eventId).toBe("verified-planner:agent-run:no-trace:planner_prompt_received");
  });

  it("supports deterministic custom event id prefixes", () => {
    const event = mapVerifiedPlannerStructuredEventToJournalEvent({
      sessionId: "agent-run:trace-005",
      eventIdPrefix: "custom-prefix",
      event: {
        event: "llm_live.planner_prompt.received",
        traceId: "trace-005",
      },
    });

    expect(event.eventId).toBe("custom-prefix:trace-005:planner_prompt_received");
  });

  it("rejects empty session id and event id prefix", () => {
    expect(() =>
      mapVerifiedPlannerStructuredEventToJournalEvent({
        sessionId: "",
        event: {
          event: "llm_live.planner_prompt.received",
        },
      }),
    ).toThrow("sessionId must be a non-empty string");

    expect(() =>
      mapVerifiedPlannerStructuredEventToJournalEvent({
        sessionId: "agent-run:trace-006",
        eventIdPrefix: "",
        event: {
          event: "llm_live.planner_prompt.received",
        },
      }),
    ).toThrow("eventIdPrefix must be a non-empty string");
  });
});