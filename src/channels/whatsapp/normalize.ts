import type { CustomerMessage } from "../../customer-messages/types";
import type { WhatsAppInboundMessage, WhatsAppWebhookPayload, WhatsAppWebhookValue } from "./types";

export interface NormalizeWhatsAppWebhookSuccess {
  ok: true;
  value: CustomerMessage[];
}

export interface NormalizeWhatsAppWebhookFailure {
  ok: false;
  error: string;
}

export type NormalizeWhatsAppWebhookResult =
  | NormalizeWhatsAppWebhookSuccess
  | NormalizeWhatsAppWebhookFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toIsoFromUnixSeconds(timestamp: string): string | undefined {
  if (!/^\d+$/.test(timestamp)) {
    return undefined;
  }

  const millis = Number(timestamp) * 1000;
  if (!Number.isFinite(millis)) {
    return undefined;
  }

  return new Date(millis).toISOString();
}

function resolveProfileName(value: WhatsAppWebhookValue, from: string): string | undefined {
  for (const contact of value.contacts ?? []) {
    if (contact?.wa_id === from && isNonEmptyString(contact.profile?.name)) {
      return contact.profile.name.trim();
    }
  }

  return undefined;
}

function normalizeTextMessage(
  value: WhatsAppWebhookValue,
  message: WhatsAppInboundMessage
): CustomerMessage | undefined {
  if (message.type !== "text") {
    return undefined;
  }

  if (!isNonEmptyString(message.id)) {
    return undefined;
  }

  if (!isNonEmptyString(message.from)) {
    return undefined;
  }

  if (!isNonEmptyString(message.timestamp)) {
    return undefined;
  }

  if (!isNonEmptyString(message.text?.body)) {
    return undefined;
  }

  const receivedAtIso = toIsoFromUnixSeconds(message.timestamp.trim());
  if (!receivedAtIso) {
    return undefined;
  }

  const from = message.from.trim();
  const text = message.text.body.trim();
  if (text.length === 0) {
    return undefined;
  }

  return {
    channel: "whatsapp",
    channelMessageId: message.id.trim(),
    customerId: from,
    text,
    receivedAtIso,
    traceId: "whatsapp:" + message.id.trim(),
    metadata: {
      whatsappPhoneNumberId: isNonEmptyString(value.metadata?.phone_number_id)
        ? value.metadata.phone_number_id.trim()
        : undefined,
      whatsappDisplayPhoneNumber: isNonEmptyString(value.metadata?.display_phone_number)
        ? value.metadata.display_phone_number.trim()
        : undefined,
      whatsappWaId: from,
      profileName: resolveProfileName(value, from),
    },
  };
}

export function normalizeWhatsAppWebhook(payload: unknown): NormalizeWhatsAppWebhookResult {
  if (!isObject(payload)) {
    return { ok: false, error: "payload must be an object" };
  }

  const typed = payload as WhatsAppWebhookPayload;

  if (typed.object !== "whatsapp_business_account") {
    return { ok: false, error: "unsupported webhook object" };
  }

  const normalized: CustomerMessage[] = [];

  for (const entry of typed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) {
        continue;
      }

      for (const message of change.value.messages ?? []) {
        const next = normalizeTextMessage(change.value, message);
        if (next) {
          normalized.push(next);
        }
      }
    }
  }

  return { ok: true, value: normalized };
}
