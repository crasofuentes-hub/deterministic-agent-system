import { describe, expect, it } from "vitest";
import { checkReplayTenantOwnership } from "../../src/replay";
import type { StoredJournalEvent } from "../../src/journal";

function event(overrides: Partial<StoredJournalEvent> = {}): StoredJournalEvent {
  return {
    eventId: "event-001",
    sessionId: "session-001",
    sequence: 1,
    timestamp: "2026-05-14T00:00:00.000Z",
    type: "message_processed",
    payload: {
      tenantId: "tenant-a",
    },
    hashPrev: null,
    hashSelf: "hash-001",
    ...overrides,
  };
}

describe("replay tenant ownership guard", () => {
  it("accepts events owned by the expected tenant", () => {
    expect(
      checkReplayTenantOwnership({
        expectedTenantId: "tenant-a",
        events: [
          event({
            sequence: 1,
            eventId: "event-001",
          }),
          event({
            sequence: 2,
            eventId: "event-002",
            hashPrev: "hash-001",
            hashSelf: "hash-002",
          }),
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("uses metadata tenant id when payload tenant id is absent", () => {
    expect(
      checkReplayTenantOwnership({
        expectedTenantId: "tenant-a",
        events: [
          event({
            payload: {},
            metadata: {
              tenantId: "tenant-a",
            },
          }),
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects events without tenant ownership", () => {
    expect(
      checkReplayTenantOwnership({
        expectedTenantId: "tenant-a",
        events: [
          event({
            payload: {},
            metadata: {},
          }),
        ],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "REPLAY_EVENT_TENANT_MISSING",
        message: "Replay event is missing tenant ownership",
        sequence: 1,
        eventId: "event-001",
        expectedTenantId: "tenant-a",
      },
    });
  });

  it("rejects cross-tenant replay access", () => {
    expect(
      checkReplayTenantOwnership({
        expectedTenantId: "tenant-a",
        events: [
          event({
            payload: {
              tenantId: "tenant-b",
            },
          }),
        ],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "REPLAY_TENANT_MISMATCH",
        message: "Replay event tenant does not match expected tenant",
        sequence: 1,
        eventId: "event-001",
        actualTenantId: "tenant-b",
        expectedTenantId: "tenant-a",
      },
    });
  });

  it("rejects empty expected tenant id deterministically", () => {
    expect(() =>
      checkReplayTenantOwnership({
        expectedTenantId: "",
        events: [],
      }),
    ).toThrow("expectedTenantId must be a non-empty string");
  });
});