import type { ServerResponse } from "node:http";
import type { WhatsAppStore } from "../../channels/whatsapp/store";
import { sendJson } from "../responses";

export function handleCloseWhatsAppHandoff(
  res: ServerResponse,
  store: WhatsAppStore,
  handoffId: string
): void {
  const normalizedHandoffId = handoffId.trim();
  const existing = store.listHandoffs().find((item) => item.handoffId === normalizedHandoffId);

  if (!existing) {
    sendJson(res, 404, {
      ok: false,
      error: "handoff not found",
    });
    return;
  }

  const updated = {
    ...existing,
    status: "closed" as const,
    updatedAtIso: new Date().toISOString(),
  };

  store.saveHandoff(updated);

  sendJson(res, 200, {
    ok: true,
    item: updated,
  });
}