import type { ServerResponse } from "node:http";
import type { WhatsAppStore } from "../../channels/whatsapp/store";
import { sendJson } from "../responses";

export function handleListWhatsAppHandoffs(
  res: ServerResponse,
  store: WhatsAppStore,
  onlyOpen = true
): void {
  const items = store.listHandoffs();
  const filtered = onlyOpen ? items.filter((item) => item.status === "open") : items;

  sendJson(res, 200, {
    ok: true,
    count: filtered.length,
    items: filtered,
  });
}