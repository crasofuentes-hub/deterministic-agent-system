import { describe, expect, it } from "vitest";
import {
  buildVerifiedPlannerJournalEvent,
  recordVerifiedPlannerJournalEvent,
  type VerifiedPlannerJournalAppendInput,
  type VerifiedPlannerJournalWriter,
} from "../../src/journal";

describe("verified planner journal metadata adapter", () => {
  it("builds deterministic journal event payload for verified planner metadata", () => {
    const event = buildVerifiedPlannerJournalEvent({
      eventId: "verified-planner:trace-001:verified",
      sessionId: "agent-run:trace-001",
      type: "planner_prompt_verified",
      traceId: "trace-001",
      tenantId: "tenant-journal-001",
      planId: "verified-plan-v1",
      llmPlanTextFormat: "planner-prompt-output",
      promptContractId: "planner.deterministic",
      promptContractVersion: "1.1.0",
      toolNames: ["policy.coverage.get", "math/add"],
      executable: true,
      stepCount: 2,
    });

    expect(event).toEqual({
      eventId: "verified-planner:trace-001:verified",
      sessionId: "agent-run:trace-001",
      type: "planner_prompt_verified",
      payload: {
        traceId: "trace-001",
        tenantId: "tenant-journal-001",
        planId: "verified-plan-v1",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add", "policy.coverage.get"],
        executable: true,
        stepCount: 2,
      },
      metadata: {
        subsystem: "llm-live",
        source: "verified-planner",
      },
    });
  });

  it("omits undefined payload fields", () => {
    const event = buildVerifiedPlannerJournalEvent({
      eventId: "verified-planner:trace-002:received",
      sessionId: "agent-run:trace-002",
      type: "planner_prompt_received",
      traceId: "trace-002",
      llmPlanTextFormat: "planner-prompt-output",
    });

    expect(event.payload).toEqual({
      traceId: "trace-002",
      llmPlanTextFormat: "planner-prompt-output",
    });
  });

  it("records verified planner metadata through a journal writer", async () => {
    const events: VerifiedPlannerJournalAppendInput[] = [];

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent(event) {
        events.push(event);
      },
    };

    await recordVerifiedPlannerJournalEvent(journal, {
      eventId: "verified-planner:trace-003:rejected",
      sessionId: "agent-run:trace-003",
      type: "planner_prompt_rejected",
      traceId: "trace-003",
      llmPlanTextFormat: "planner-prompt-output",
      promptContractId: "planner.deterministic",
      promptContractVersion: "1.1.0",
      errorCode: "LLM_LIVE_PLANNER_CONTRACT_INVALID",
      issueCount: 1,
    });

    expect(events).toEqual([
      {
        eventId: "verified-planner:trace-003:rejected",
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
      },
    ]);
  });

  it("rejects empty event and session identifiers", () => {
    expect(() =>
      buildVerifiedPlannerJournalEvent({
        eventId: "",
        sessionId: "agent-run:trace-004",
        type: "planner_prompt_received",
      }),
    ).toThrow("eventId must be a non-empty string");

    expect(() =>
      buildVerifiedPlannerJournalEvent({
        eventId: "verified-planner:trace-004:received",
        sessionId: "",
        type: "planner_prompt_received",
      }),
    ).toThrow("sessionId must be a non-empty string");
  });
});