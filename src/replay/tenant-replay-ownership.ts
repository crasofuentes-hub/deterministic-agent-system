import type { StoredJournalEvent } from "../journal";

export interface ReplayTenantOwnershipCheckInput {
  readonly events: readonly StoredJournalEvent[];
  readonly expectedTenantId: string;
}

export type ReplayTenantOwnershipCheckResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          | "REPLAY_EVENT_TENANT_MISSING"
          | "REPLAY_TENANT_MISMATCH";
        readonly message: string;
        readonly sequence?: number;
        readonly eventId?: string;
        readonly actualTenantId?: string;
        readonly expectedTenantId?: string;
      };
    };

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

function readEventTenantId(event: StoredJournalEvent): string | undefined {
  const payloadTenantId = event.payload.tenantId;
  if (typeof payloadTenantId === "string" && payloadTenantId.trim().length > 0) {
    return payloadTenantId.trim();
  }

  const metadataTenantId = event.metadata?.tenantId;
  if (typeof metadataTenantId === "string" && metadataTenantId.trim().length > 0) {
    return metadataTenantId.trim();
  }

  return undefined;
}

export function checkReplayTenantOwnership(
  input: ReplayTenantOwnershipCheckInput,
): ReplayTenantOwnershipCheckResult {
  const expectedTenantId = readNonEmptyString(input.expectedTenantId, "expectedTenantId");

  for (const event of input.events) {
    const actualTenantId = readEventTenantId(event);

    if (typeof actualTenantId === "undefined") {
      return {
        ok: false,
        error: {
          code: "REPLAY_EVENT_TENANT_MISSING",
          message: "Replay event is missing tenant ownership",
          sequence: event.sequence,
          eventId: event.eventId,
          expectedTenantId,
        },
      };
    }

    if (actualTenantId !== expectedTenantId) {
      return {
        ok: false,
        error: {
          code: "REPLAY_TENANT_MISMATCH",
          message: "Replay event tenant does not match expected tenant",
          sequence: event.sequence,
          eventId: event.eventId,
          actualTenantId,
          expectedTenantId,
        },
      };
    }
  }

  return { ok: true };
}