import { describe, expect, it } from "vitest";
import {
  createInMemoryExecutionJournal,
  type ExecutionJournal,
  type SessionJournal,
} from "../../src/journal";
import {
  replaySession,
  replayUntilSequence,
  replayWithOverride,
} from "../../src/replay";

async function seedJournal(): Promise<ExecutionJournal> {
  const journal = createInMemoryExecutionJournal();

  await journal.appendEvent({
    eventId: "evt-session-001-received",
    sessionId: "whatsapp:5215512345678",
    timestamp: "2026-05-06T00:00:00.000Z",
    type: "message_received",
    payload: {
      channel: "whatsapp",
      customerId: "5215512345678",
      channelMessageId: "wamid.replay.001",
      text: "Coverage details for POL-AUTO-1001",
    },
    metadata: {
      requestId: "req-replay-001",
    },
  });

  await journal.appendEvent({
    eventId: "evt-session-001-processed",
    sessionId: "whatsapp:5215512345678",
    timestamp: "2026-05-06T00:00:01.000Z",
    type: "message_processed",
    payload: {
      channel: "whatsapp",
      customerId: "5215512345678",
      channelMessageId: "wamid.replay.001",
      duplicate: false,
      deliveryStatus: "skipped",
      responseId: "consult-coverage-resolved",
      resolvedIntentId: "consult-coverage",
      stage: "resolve-coverage",
      status: "resolved",
      humanInterventionRequired: false,
    },
    metadata: {
      requestId: "req-replay-001",
    },
  });

  await journal.appendEvent({
    eventId: "evt-session-001-handoff",
    sessionId: "whatsapp:5215512345678",
    timestamp: "2026-05-06T00:00:02.000Z",
    type: "handoff",
    payload: {
      channel: "whatsapp",
      customerId: "5215512345678",
      channelMessageId: "wamid.replay.002",
      handoffId: "handoff:5215512345678:wamid.replay.002",
      responseId: "handoff-requested",
      resolvedIntentId: "request-human-handoff",
      stage: "handoff-requested",
      status: "handoff",
      handoffReasonCode: "requested_by_customer",
      handoffQueue: "general-support",
    },
    metadata: {
      requestId: "req-replay-002",
    },
  });

  return journal;
}

describe("journal replay engine", () => {
  it("replays an intact session and returns deterministic replay state", async () => {
    const journal = await seedJournal();

    const firstReplay = await replaySession(journal, "whatsapp:5215512345678");
    const secondReplay = await replaySession(journal, "whatsapp:5215512345678");

    expect(firstReplay).toMatchObject({
      ok: true,
      sessionId: "whatsapp:5215512345678",
      integrityOk: true,
      replayedUntilSequence: 3,
      eventsReplayed: 3,
      finalState: {
        sessionId: "whatsapp:5215512345678",
        eventCount: 3,
        eventTypes: {
          message_received: 1,
          message_processed: 1,
          handoff: 1,
        },
        lastEventId: "evt-session-001-handoff",
        lastEventType: "handoff",
        lastSequence: 3,
        lastTimestamp: "2026-05-06T00:00:02.000Z",
        appliedOverrides: [],
      },
    });

    expect(firstReplay.ok && firstReplay.replayHash).toBe(
      secondReplay.ok && secondReplay.replayHash,
    );
  });

  it("replays until a specific sequence", async () => {
    const journal = await seedJournal();

    const result = await replayUntilSequence(journal, "whatsapp:5215512345678", 2);

    expect(result).toMatchObject({
      ok: true,
      sessionId: "whatsapp:5215512345678",
      integrityOk: true,
      replayedUntilSequence: 2,
      eventsReplayed: 2,
      finalState: {
        eventCount: 2,
        eventTypes: {
          message_received: 1,
          message_processed: 1,
        },
        lastEventId: "evt-session-001-processed",
        lastEventType: "message_processed",
        lastSequence: 2,
      },
    });

    if (!result.ok) {
      throw new Error("Expected replay result to be successful");
    }

    expect(result.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("fails deterministically when replay sequence does not exist", async () => {
    const journal = await seedJournal();

    await expect(
      replayUntilSequence(journal, "whatsapp:5215512345678", 99),
    ).resolves.toEqual({
      ok: false,
      sessionId: "whatsapp:5215512345678",
      integrityOk: false,
      error: {
        code: "REPLAY_SEQUENCE_NOT_FOUND",
        message: "Replay sequence was not found: 99",
      },
    });
  });

  it("supports replay overrides without mutating the original journal", async () => {
    const journal = await seedJournal();

    const original = await replaySession(journal, "whatsapp:5215512345678");

    const overridden = await replayWithOverride(journal, "whatsapp:5215512345678", [
      {
        sequence: 2,
        payload: {
          channel: "whatsapp",
          customerId: "5215512345678",
          channelMessageId: "wamid.replay.001",
          duplicate: false,
          deliveryStatus: "skipped",
          responseId: "override-response",
          resolvedIntentId: "override-intent",
          stage: "override-stage",
          status: "resolved",
          humanInterventionRequired: false,
        },
      },
    ]);

    const replayAfterOverride = await replaySession(journal, "whatsapp:5215512345678");

    if (!original.ok || !overridden.ok || !replayAfterOverride.ok) {
      throw new Error("Expected replay results to be successful");
    }

    expect(overridden.finalState.appliedOverrides).toEqual([
      {
        sequence: 2,
        eventId: "evt-session-001-processed",
        changedPayload: true,
        changedMetadata: false,
      },
    ]);

    expect(overridden.events[1].payload).toMatchObject({
      responseId: "override-response",
      resolvedIntentId: "override-intent",
      stage: "override-stage",
    });

    expect(replayAfterOverride.events[1].payload).toMatchObject({
      responseId: "consult-coverage-resolved",
      resolvedIntentId: "consult-coverage",
      stage: "resolve-coverage",
    });

    expect(overridden.replayHash).not.toBe(original.replayHash);
    expect(replayAfterOverride.replayHash).toBe(original.replayHash);
  });

  it("fails deterministically if journal integrity check fails", async () => {
    const brokenJournal: ExecutionJournal = {
      async appendEvent() {
        throw new Error("not used");
      },
      async verifyChain() {
        return false;
      },
      async getSessionJournal(sessionId: string): Promise<SessionJournal> {
        return {
          sessionId,
          integrityOk: false,
          events: [],
        };
      },
    };

    await expect(replaySession(brokenJournal, "session-broken")).resolves.toEqual({
      ok: false,
      sessionId: "session-broken",
      integrityOk: false,
      error: {
        code: "JOURNAL_INTEGRITY_CHECK_FAILED",
        message: "Journal integrity check failed for session: session-broken",
      },
    });
  });

  it("rejects invalid overrides deterministically", async () => {
    const journal = await seedJournal();

    await expect(
      replayWithOverride(journal, "whatsapp:5215512345678", [
        {
          sequence: 2,
          eventId: "evt-session-001-processed",
          payload: {},
        },
      ]),
    ).resolves.toEqual({
      ok: false,
      sessionId: "whatsapp:5215512345678",
      integrityOk: false,
      error: {
        code: "INVALID_REPLAY_OVERRIDE",
        message: "Replay override must specify exactly one of sequence or eventId",
      },
    });

    await expect(
      replayWithOverride(journal, "whatsapp:5215512345678", [
        {
          sequence: 99,
          payload: {},
        },
      ]),
    ).resolves.toEqual({
      ok: false,
      sessionId: "whatsapp:5215512345678",
      integrityOk: false,
      error: {
        code: "INVALID_REPLAY_OVERRIDE",
        message: "Replay override did not match any event: sequence:99",
      },
    });
  });
});