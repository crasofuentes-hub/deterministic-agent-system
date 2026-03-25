import type { WhatsAppSender, WhatsAppSendResult } from "./client";
import type { WhatsAppTextOutboundPayload } from "./send";

export interface WhatsAppHttpFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type WhatsAppHttpFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<WhatsAppHttpFetchResponse>;

export interface CreateHttpWhatsAppSenderOptions {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  fetchImpl: WhatsAppHttpFetch;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildMessagesUrl(apiVersion: string, phoneNumberId: string): string {
  if (!isNonEmptyString(apiVersion)) {
    throw new Error("apiVersion must be a non-empty string");
  }

  if (!isNonEmptyString(phoneNumberId)) {
    throw new Error("phoneNumberId must be a non-empty string");
  }

  return (
    "https://graph.facebook.com/" + apiVersion.trim() + "/" + phoneNumberId.trim() + "/messages"
  );
}

function extractProviderMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const data = payload as {
    messages?: Array<{
      id?: string;
    }>;
  };

  const id = data.messages?.[0]?.id;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;
}

export function createHttpWhatsAppSender(options: CreateHttpWhatsAppSenderOptions): WhatsAppSender {
  if (!isNonEmptyString(options.accessToken)) {
    throw new Error("accessToken must be a non-empty string");
  }

  const url = buildMessagesUrl(options.apiVersion, options.phoneNumberId);
  const token = options.accessToken.trim();

  return {
    async send(payload: WhatsAppTextOutboundPayload): Promise<WhatsAppSendResult> {
      const response = await options.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          mode: "http",
          error: "whatsapp http send failed",
          statusCode: response.status,
        };
      }

      return {
        ok: true,
        mode: "http",
        providerMessageId: extractProviderMessageId(body) ?? "whatsapp-http-message-unknown",
        acceptedAtIso: "2026-03-24T00:00:00.000Z",
      };
    },
  };
}
