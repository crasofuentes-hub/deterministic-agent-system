import type { ServerResponse } from "node:http";
import type { ExecutionJournal } from "../../journal";
import { replaySession } from "../../replay";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildWhatsAppJournalSessionId(customerId: string): string {
  return "whatsapp:" + customerId;
}

export async function handleGetWhatsAppConversationReplay(
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
  const replay = await replaySession(journal, sessionId);

  if (!replay.ok) {
    sendJson(res, 409, {
      ok: false,
      customerId: normalizedCustomerId,
      sessionId,
      integrityOk: replay.integrityOk,
      error: replay.error,
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    customerId: normalizedCustomerId,
    sessionId,
    integrityOk: replay.integrityOk,
    replayedUntilSequence: replay.replayedUntilSequence,
    eventsReplayed: replay.eventsReplayed,
    finalState: replay.finalState,
    replayHash: replay.replayHash,
  });
}