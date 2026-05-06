import { describe, expect, it } from "vitest";
import {
  createInMemoryExecutionJournal,
  hashJournalEventContent,
  verifyJournalEventChain,
  type StoredJournalEvent,
} from "../../src/journal";

describe("tamper evident execution journal", () => {
  it("appends events with deterministic sequence, hashPrev, and hashSelf", async () => {
    const journal = createInMemoryExecutionJournal();

    const first = await journal.appendEvent({
      eventId: "evt-plan-001",
      sessionId: "session-001",
      timestamp: "2026-05-06T00:00:00.000Z",
      type: "plan",
      payload: {
        planId: "plan-001",
        planner: "deterministic",
      },
    });

    const second = await journal.appendEvent({
      eventId: "evt-tool-call-001",
      sessionId: "session-001",
      timestamp: "2026-05-06T00:00:01.000Z",
      type: "tool_call",
      payload: {
        toolId: "math.add",
        input: {
          left: 2,
          right: 3,
        },
      },
      metadata: {
        adapter: "inline",
      },
    });

    expect(first).toMatchObject({
      eventId: "evt-plan-001",
      sessionId: "session-001",
      sequence: 1,
      timestamp: "2026-05-06T00:00:00.000Z",
      type: "plan",
      hashPrev: null,
    });

    expect(first.hashSelf).toBe(
      hashJournalEventContent({
        eventId: "evt-plan-001",
        sessionId: "session-001",
        sequence: 1,
        timestamp: "2026-05-06T00:00:00.000Z",
        type: "plan",
        payload: {
          planId: "plan-001",
          planner: "deterministic",
        },
        hashPrev: null,
      }),
    );

    expect(second.sequence).toBe(2);
    expect(second.hashPrev).toBe(first.hashSelf);
    expect(second.hashSelf).toBe(
      hashJournalEventContent({
        eventId: "evt-tool-call-001",
        sessionId: "session-001",
        sequence: 2,
        timestamp: "2026-05-06T00:00:01.000Z",
        type: "tool_call",
        payload: {
          toolId: "math.add",
          input: {
            left: 2,
            right: 3,
          },
        },
        hashPrev: first.hashSelf,
        metadata: {
          adapter: "inline",
        },
      }),
    );

    await expect(journal.verifyChain("session-001")).resolves.toBe(true);
  });

  it("returns session journals with optional integrity checks", async () => {
    const journal = createInMemoryExecutionJournal();

    await journal.appendEvent({
      eventId: "evt-001",
      sessionId: "session-002",
      timestamp: "2026-05-06T01:00:00.000Z",
      type: "llm_response",
      payload: {
        responseId: "response-001",
        canonical: true,
      },
    });

    await expect(
      journal.getSessionJournal("session-002", { integrityCheck: true }),
    ).resolves.toMatchObject({
      sessionId: "session-002",
      integrityOk: true,
      events: [
        {
          eventId: "evt-001",
          sessionId: "session-002",
          sequence: 1,
          type: "llm_response",
          hashPrev: null,
        },
      ],
    });
  });

  it("detects tampered payloads", async () => {
    const journal = createInMemoryExecutionJournal();

    const event = await journal.appendEvent({
      eventId: "evt-error-001",
      sessionId: "session-003",
      timestamp: "2026-05-06T02:00:00.000Z",
      type: "error",
      payload: {
        code: "ORIGINAL_ERROR",
      },
    });

    const tampered: StoredJournalEvent = {
      ...event,
      payload: {
        code: "TAMPERED_ERROR",
      },
    };

    expect(verifyJournalEventChain([tampered])).toBe(false);
  });

  it("detects broken hashPrev links", async () => {
    const journal = createInMemoryExecutionJournal();

    const first = await journal.appendEvent({
      eventId: "evt-001",
      sessionId: "session-004",
      timestamp: "2026-05-06T03:00:00.000Z",
      type: "plan",
      payload: {
        planId: "plan-001",
      },
    });

    const second = await journal.appendEvent({
      eventId: "evt-002",
      sessionId: "session-004",
      timestamp: "2026-05-06T03:00:01.000Z",
      type: "convergence",
      payload: {
        converged: true,
      },
    });

    const broken: StoredJournalEvent = {
      ...second,
      hashPrev: "not-the-previous-hash",
    };

    expect(verifyJournalEventChain([first, broken])).toBe(false);
  });

  it("detects broken sequence ordering", async () => {
    const journal = createInMemoryExecutionJournal();

    const event = await journal.appendEvent({
      eventId: "evt-handoff-001",
      sessionId: "session-005",
      timestamp: "2026-05-06T04:00:00.000Z",
      type: "handoff",
      payload: {
        reason: "human_required",
      },
    });

    const broken: StoredJournalEvent = {
      ...event,
      sequence: 2,
    };

    expect(verifyJournalEventChain([broken])).toBe(false);
  });

  it("keeps canonical hashing stable across object key order", () => {
    const left = hashJournalEventContent({
      eventId: "evt-stable-001",
      sessionId: "session-006",
      sequence: 1,
      timestamp: "2026-05-06T05:00:00.000Z",
      type: "tool_result",
      payload: {
        b: 2,
        a: 1,
      },
      hashPrev: null,
    });

    const right = hashJournalEventContent({
      eventId: "evt-stable-001",
      sessionId: "session-006",
      sequence: 1,
      timestamp: "2026-05-06T05:00:00.000Z",
      type: "tool_result",
      payload: {
        a: 1,
        b: 2,
      },
      hashPrev: null,
    });

    expect(left).toBe(right);
  });

  it("rejects invalid append inputs deterministically", async () => {
    const journal = createInMemoryExecutionJournal();

    await expect(
      journal.appendEvent({
        eventId: " ",
        sessionId: "session-007",
        timestamp: "2026-05-06T06:00:00.000Z",
        type: "plan",
        payload: {},
      }),
    ).rejects.toThrow("eventId must be a non-empty string");

    await expect(journal.verifyChain(" ")).rejects.toThrow(
      "sessionId must be a non-empty string",
    );
  });
});