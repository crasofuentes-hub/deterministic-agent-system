import type { ServerResponse } from "node:http";
import type { ExecutionJournal } from "../../journal";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildWhatsAppJournalSessionId(customerId: string): string {
  return "whatsapp:" + customerId;
}

export async function handleGetWhatsAppConversationJournal(
  res: ServerResponse,
  journal: ExecutionJournal,
  customerId: string,
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

  sendJson(res, 200, {
    ok: true,
    customerId: normalizedCustomerId,
    sessionId,
    integrityOk: sessionJournal.integrityOk === true,
    count: sessionJournal.events.length,
    events: sessionJournal.events,
  });
}