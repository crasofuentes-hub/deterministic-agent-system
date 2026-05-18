import type { ServerResponse } from "node:http";
import type { ExecutionJournal } from "../../journal";
import { createRequestIdentity } from "../../core/request-identity";
import { checkRequestScope } from "../../core/request-scope";
import { checkReplayTenantOwnership } from "../../replay";
import { sendInvalidRequest, sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildWhatsAppJournalSessionId(customerId: string): string {
  return "whatsapp:" + customerId;
}
export interface WhatsAppConversationJournalOptions {
  readonly tenantId?: unknown;
  readonly subjectId?: unknown;
  readonly scopes?: unknown;
}

function parseJournalRequestIdentity(options: WhatsAppConversationJournalOptions) {
  return createRequestIdentity({
    tenantId: options.tenantId,
    subjectId: options.subjectId,
    scopes: options.scopes,
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

  const tenantContext = parseJournalRequestIdentity(options);
  if (!tenantContext.ok) {
    sendInvalidRequest(res, "Request validation failed: " + tenantContext.error.message);
    return;
  }

  const journalReadScope = checkRequestScope({
    identity: tenantContext.value,
    requiredScope: "journal:read",
  });
  if (!journalReadScope.ok) {
    sendJson(res, 403, {
      ok: false,
      sessionId,
      error: journalReadScope.error,
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