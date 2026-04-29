import type { ServerResponse } from "node:http";
import type { WhatsAppStore } from "../../channels/whatsapp/store";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function handleGetWhatsAppConversationEvidence(
  res: ServerResponse,
  store: WhatsAppStore,
  customerId: string
): void {
  if (!isNonEmptyString(customerId)) {
    sendJson(res, 400, {
      ok: false,
      error: "customerId must be a non-empty string",
    });
    return;
  }

  const normalizedCustomerId = customerId.trim();
  const evidence = store.loadEvidence(normalizedCustomerId);

  if (!evidence) {
    sendJson(res, 404, {
      ok: false,
      error: "conversation evidence not found",
      customerId: normalizedCustomerId,
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    customerId: normalizedCustomerId,
    evidence,
  });
}