import type { IncomingMessage, ServerResponse } from "node:http";
import { runWhatsAppCustomerServiceBridge } from "../../channels/whatsapp/agent-bridge";
import { normalizeWhatsAppWebhook } from "../../channels/whatsapp/normalize";
import { buildWhatsAppTextOutbound } from "../../channels/whatsapp/send";
import { createInitialSessionState, type SessionState } from "../../session-state/session-state";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readQueryParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key);
  return isNonEmptyString(value) ? value.trim() : undefined;
}

export interface HandleWhatsAppWebhookOptions {
  verifyToken: string;
  bodyText?: string;
  loadSession?: (customerId: string) => SessionState;
}

export async function handleWhatsAppWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  options: HandleWhatsAppWebhookOptions
): Promise<void> {
  const method = request.method ?? "GET";

  if (method === "GET") {
    const host = request.headers.host ?? "localhost";
    const protocol = request.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const requestUrl = new URL(request.url ?? "/", protocol + "://" + host);

    const mode = readQueryParam(requestUrl, "hub.mode");
    const token = readQueryParam(requestUrl, "hub.verify_token");
    const challenge = readQueryParam(requestUrl, "hub.challenge");

    if (mode !== "subscribe") {
      return sendJson(response, 400, {
        ok: false,
        error: "hub.mode must be subscribe",
      });
    }

    if (!isNonEmptyString(token)) {
      return sendJson(response, 400, {
        ok: false,
        error: "hub.verify_token is required",
      });
    }

    if (token !== options.verifyToken) {
      return sendJson(response, 403, {
        ok: false,
        error: "invalid verify token",
      });
    }

    if (!isNonEmptyString(challenge)) {
      return sendJson(response, 400, {
        ok: false,
        error: "hub.challenge is required",
      });
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(challenge);
    return;
  }

  if (method !== "POST") {
    return sendJson(response, 405, {
      ok: false,
      error: "method not allowed",
    });
  }

  const bodyText = options.bodyText ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      error: "body must be valid JSON",
    });
  }

  const normalized = normalizeWhatsAppWebhook(parsed);
  if (!normalized.ok) {
    return sendJson(response, 400, {
      ok: false,
      error: normalized.error,
    });
  }

  const results = normalized.value.map((message) => {
    const session =
      options.loadSession?.(message.customerId) ??
      createInitialSessionState({
        sessionId: "whatsapp-session:" + message.customerId,
        businessContextId: "customer-service-core-v2",
      });

    const bridge = runWhatsAppCustomerServiceBridge({
      session,
      message,
    });

    const outbound = buildWhatsAppTextOutbound({
      to: bridge.output.customerId,
      body: bridge.output.outboundText,
    });

    return {
      message,
      agent: bridge.output,
      outbound,
      session: bridge.session,
    };
  });

  return sendJson(response, 200, {
    ok: true,
    messagesReceived: normalized.value.length,
    results,
  });
}
