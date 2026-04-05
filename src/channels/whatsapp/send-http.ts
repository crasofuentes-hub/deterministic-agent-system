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
    signal?: AbortSignal;
  }
) => Promise<WhatsAppHttpFetchResponse>;

export interface CreateHttpWhatsAppSenderOptions {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  fetchImpl: WhatsAppHttpFetch;
  timeoutMs?: number;
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

async function readJsonSafely(
  response: WhatsAppHttpFetchResponse
): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
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
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : 10000;

  if (timeoutMs <= 0) {
    throw new Error("timeoutMs must be greater than 0");
  }

  return {
    async send(payload: WhatsAppTextOutboundPayload): Promise<WhatsAppSendResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await options.fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const body = await readJsonSafely(response);

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
      } catch (error) {
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "whatsapp http send timed out"
            : "whatsapp http send threw network error";

        return {
          ok: false,
          mode: "http",
          error: message,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
