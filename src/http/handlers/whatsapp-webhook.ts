import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runWhatsAppCustomerServiceBridge } from "../../channels/whatsapp/agent-bridge";
import { createMockWhatsAppSender, type WhatsAppSender } from "../../channels/whatsapp/client";
import { normalizeWhatsAppWebhook } from "../../channels/whatsapp/normalize";
import { buildWhatsAppTextOutbound } from "../../channels/whatsapp/send";
import type { WhatsAppStore } from "../../channels/whatsapp/store";
import { createInitialSessionState, type SessionState } from "../../session-state/session-state";
import { sendJson } from "../responses";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readQueryParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key);
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function getRequestId(request: IncomingMessage): string | undefined {
  const value = request.headers["x-request-id"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
function getSignatureHeader(request: IncomingMessage): string | undefined {
  const value = request.headers["x-hub-signature-256"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isValidMetaWebhookSignature(bodyText: string, appSecret: string, signatureHeader: string): boolean {
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) {
    return false;
  }

  const receivedHex = signatureHeader.slice(expectedPrefix.length);
  if (!/^[a-fA-F0-9]{64}$/.test(receivedHex)) {
    return false;
  }

  const expectedHex = crypto.createHmac("sha256", appSecret).update(bodyText, "utf8").digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function validateMetaWebhookSignature(
  request: IncomingMessage,
  bodyText: string,
  appSecret: string | undefined
): { ok: true } | { ok: false; statusCode: 400 | 403; error: string } {
  if (typeof appSecret !== "string" || appSecret.trim().length === 0) {
    return { ok: true };
  }

  const signatureHeader = getSignatureHeader(request);
  if (!signatureHeader) {
    return {
      ok: false,
      statusCode: 400,
      error: "x-hub-signature-256 header is required",
    };
  }

  if (!isValidMetaWebhookSignature(bodyText, appSecret.trim(), signatureHeader)) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid whatsapp webhook signature",
    };
  }

  return { ok: true };
}

function extractProviderMessageId(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const typed = result as {
    ok?: boolean;
    providerMessageId?: string;
  };

  return typeof typed.providerMessageId === "string" && typed.providerMessageId.trim().length > 0
    ? typed.providerMessageId.trim()
    : null;
}

function logDeliveryEvent(event: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      subsystem: "whatsapp",
      ...event,
    })
  );
}

export interface HandleWhatsAppWebhookOptions {
  verifyToken: string;
  bodyText?: string;
  loadSession?: (customerId: string) => SessionState;
  deliveryMode?: "skipped" | "mock" | "http";
  sender?: WhatsAppSender;
  store?: WhatsAppStore;
  businessContextId?: string;
  appSecret?: string;
}

export async function handleWhatsAppWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  options: HandleWhatsAppWebhookOptions
): Promise<void> {
  const method = request.method ?? "GET";
  const requestId = getRequestId(request);

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

  const signatureValidation = validateMetaWebhookSignature(request, bodyText, options.appSecret);
  if (!signatureValidation.ok) {
    return sendJson(response, signatureValidation.statusCode, {
      ok: false,
      error: signatureValidation.error,
    });
  }

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

  const deliveryMode = options.deliveryMode ?? "skipped";
  const sender =
    deliveryMode === "mock"
      ? createMockWhatsAppSender()
      : deliveryMode === "http"
        ? options.sender
        : undefined;

  if (deliveryMode === "http" && !sender) {
    return sendJson(response, 500, {
      ok: false,
      error: "http delivery mode requires sender",
    });
  }

  const businessContextId = options.businessContextId ?? "customer-service-core-v2";

  const results = await Promise.all(
    normalized.value.map(async (message) => {
      if (options.store?.hasProcessedMessage(message.channelMessageId)) {
        logDeliveryEvent({
          event: "delivery.duplicate",
          requestId,
          channelMessageId: message.channelMessageId,
          customerId: message.customerId,
          duplicate: true,
          deliveryMode: "skipped",
          deliveryStatus: "skipped",
          providerMessageId: null,
          deliveryError: null,
        });

        return {
          message,
          duplicate: true,
          agent: null,
          outbound: null,
          delivery: {
            mode: "skipped",
            result: null,
            deliveryStatus: "skipped",
            deliveryError: null,
          },
          session: options.store.loadSession(message.customerId),
        };
      }

      const session = options.store
        ? options.store.loadSession(message.customerId)
        : (options.loadSession?.(message.customerId) ??
          createInitialSessionState({
            sessionId: "whatsapp-session:" + message.customerId,
            businessContextId,
          }));

      const bridge = runWhatsAppCustomerServiceBridge({
        session,
        message,
      });

      const outbound = buildWhatsAppTextOutbound({
        to: bridge.output.customerId,
        body: bridge.output.outboundText,
      });

      let delivery:
        | {
            mode: "skipped" | "mock" | "http";
            result: unknown;
            deliveryStatus: "skipped" | "sent" | "failed";
            deliveryError: string | null;
          }
        | undefined;

      if (deliveryMode === "skipped") {
        delivery = {
          mode: "skipped",
          result: null,
          deliveryStatus: "skipped",
          deliveryError: null,
        };
      } else {
        const result = await sender!.send(outbound);

        delivery = {
          mode: deliveryMode,
          result,
          deliveryStatus: result.ok ? "sent" : "failed",
          deliveryError: result.ok ? null : result.error,
        };

        logDeliveryEvent({
          event: "delivery.attempt",
          requestId,
          channelMessageId: message.channelMessageId,
          customerId: message.customerId,
          duplicate: false,
          deliveryMode,
          deliveryStatus: delivery.deliveryStatus,
          providerMessageId: extractProviderMessageId(result),
          deliveryError: delivery.deliveryError,
        });
      }

      if (options.store) {
        options.store.saveSession(message.customerId, bridge.session);
        options.store.saveEvidence({
          customerId: message.customerId,
          lastInboundMessageId: message.channelMessageId,
          lastResponseId: bridge.output.responseId,
          lastResolvedIntentId: bridge.output.resolvedIntentId,
          lastStage: bridge.output.stage,
          lastStatus: bridge.output.status,
          lastOutboundText: bridge.output.outboundText,
          humanInterventionRequired: bridge.output.humanInterventionRequired,
          handoffReasonCode: bridge.output.handoffReasonCode,
          handoffQueue: bridge.output.handoffQueue,
          updatedAtIso: message.receivedAtIso,
        });

        if (bridge.output.humanInterventionRequired) {
          options.store.saveHandoff({
            handoffId: "handoff:" + message.customerId + ":" + message.channelMessageId,
            customerId: message.customerId,
            createdAtIso: message.receivedAtIso,
            updatedAtIso: message.receivedAtIso,
            handoffReasonCode: bridge.output.handoffReasonCode,
            handoffQueue: bridge.output.handoffQueue,
            status: "open",
            lastInboundMessageId: message.channelMessageId,
            lastResponseId: bridge.output.responseId,
            lastResolvedIntentId: bridge.output.resolvedIntentId,
            lastStage: bridge.output.stage,
            lastStatus: bridge.output.status,
            lastOutboundText: bridge.output.outboundText,
          });
        }

        options.store.markMessageProcessed(message.channelMessageId);
      }

      return {
        message,
        duplicate: false,
        agent: bridge.output,
        outbound,
        delivery,
        session: bridge.session,
      };
    })
  );

  return sendJson(response, 200, {
    ok: true,
    messagesReceived: normalized.value.length,
    results,
  });
}