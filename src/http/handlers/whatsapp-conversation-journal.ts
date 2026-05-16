import type { ServerResponse } from "node:http";
import type { ExecutionJournal } from "../../journal";
import { createTenantContext } from "../../core/tenant-context";
import { checkReplayTenantOwnership } from "../../replay";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildWhatsAppJournalSessionId(customerId: string): string {
  return "whatsapp:" + customerId;
}
export interface WhatsAppConversationJournalOptions {
  readonly tenantId?: unknown;
}

function parseJournalTenantContext(options: WhatsAppConversationJournalOptions) {
  return createTenantContext({
    tenantId: options.tenantId,
    allowLocalDevFallback: true,
  });
}

export async function handleGetWhatsAppConversationJournal(
  res: ServerResponse,
  journal: ExecutionJournal,
  customerId: string,
  options: WhatsAppConversationJournalOptions = {},
): Promise<void> {
  if (!isNonEmptyString(customerId)) {
    sendJson(res, 400, {
      ok: false,
      error: "customerId must be a non-empty string",
    });
    return;
  }

  const normalizedCustomerId = customerId.trim();
  const sessionId = buildWhatsAppJournalSessionId(normalizedCustomerId);
  const sessionJournal = await journal.getSessionJournal(sessionId, {
    integrityCheck: true,
  });

  const tenantContext = parseJournalTenantContext(options);
  if (!tenantContext.ok) {
    sendJson(res, 400, {
      ok: false,
      error: "Request validation failed: " + tenantContext.error.message,
    });
    return;
  }

  const ownership = checkReplayTenantOwnership({
    events: sessionJournal.events,
    expectedTenantId: tenantContext.value.tenantId,
  });

  if (!ownership.ok) {
    sendJson(res, 403, {
      ok: false,
      sessionId,
      integrityOk: sessionJournal.integrityOk === true,
      error: ownership.error,
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    customerId: normalizedCustomerId,
    sessionId,
    integrityOk: sessionJournal.integrityOk === true,
    count: sessionJournal.events.length,
    events: sessionJournal.events,
  });
}