import type { WhatsAppTextOutboundPayload } from "./send";

export interface WhatsAppSendSuccess {
  ok: true;
  mode: "mock" | "http";
  providerMessageId: string;
  acceptedAtIso: string;
}

export interface WhatsAppSendFailure {
  ok: false;
  mode: "mock" | "http";
  error: string;
  statusCode?: number;
}

export type WhatsAppSendResult = WhatsAppSendSuccess | WhatsAppSendFailure;

export interface WhatsAppSender {
  send(payload: WhatsAppTextOutboundPayload): Promise<WhatsAppSendResult>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createMockWhatsAppSender(params?: {
  acceptedAtIso?: string;
  providerMessageId?: string;
}): WhatsAppSender {
  const acceptedAtIso = isNonEmptyString(params?.acceptedAtIso)
    ? params!.acceptedAtIso.trim()
    : "2026-03-24T00:00:00.000Z";

  const providerMessageId = isNonEmptyString(params?.providerMessageId)
    ? params!.providerMessageId.trim()
    : "mocked-whatsapp-message-001";

  return {
    async send(): Promise<WhatsAppSendResult> {
      return {
        ok: true,
        mode: "mock",
        providerMessageId,
        acceptedAtIso,
      };
    },
  };
}
