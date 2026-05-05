import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../../src/http/server";

const ENV_KEYS = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_RUNTIME_MODE",
  "WHATSAPP_STORE_MODE",
  "WHATSAPP_DELIVERY_MODE",
] as const;

const originalEnv = new Map<string, string | undefined>();

for (const key of ENV_KEYS) {
  originalEnv.set(key, process.env[key]);
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function buildInboundBody(messageId: string, userText: string): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-001",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: "phone-number-id-001",
              },
              contacts: [
                {
                  profile: {
                    name: "Oscar Cliente",
                  },
                  wa_id: "5215512345678",
                },
              ],
              messages: [
                {
                  from: "5215512345678",
                  id: messageId,
                  timestamp: "1774310400",
                  text: {
                    body: userText,
                  },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

describe("server async whatsapp runtime", () => {
  it("uses async whatsapp runtime when WHATSAPP_RUNTIME_MODE is async", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "async";
    process.env.WHATSAPP_STORE_MODE = "memory";
    process.env.WHATSAPP_DELIVERY_MODE = "skipped";

    const server = await startServer({
      port: 0,
      host: "127.0.0.1",
    });

    try {
      const verifyResponse = await fetch(
        "http://" +
          server.host +
          ":" +
          server.port +
          "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=async-server-ok"
      );

      expect(verifyResponse.status).toBe(200);
      await expect(verifyResponse.text()).resolves.toBe("async-server-ok");

      const webhookResponse = await fetch(
        "http://" + server.host + ":" + server.port + "/webhooks/whatsapp",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-server-async-coverage-001",
          },
          body: buildInboundBody(
            "wamid.server.async.coverage.001",
            "Coverage details for POL-AUTO-1001"
          ),
        }
      );

      expect(webhookResponse.status).toBe(200);

      const json = await webhookResponse.json();

      expect(json.ok).toBe(true);
      expect(json.messagesReceived).toBe(1);
      expect(json.results[0].duplicate).toBe(false);
      expect(json.results[0].agent).toEqual(
        expect.objectContaining({
          responseId: "consult-coverage-resolved",
          resolvedIntentId: "consult-coverage",
          stage: "resolve-coverage",
          status: "resolved",
          humanInterventionRequired: false,
        })
      );
    } finally {
      await server.close();
    }
  });

  it("rejects async postgres runtime when database url is missing", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "async";
    process.env.WHATSAPP_STORE_MODE = "postgres";
    delete process.env.DATABASE_URL;

    await expect(
      startServer({
        port: 0,
        host: "127.0.0.1",
      })
    ).rejects.toThrow("DATABASE_URL must be a non-empty string");
  });
  it("rejects invalid whatsapp runtime mode during startup", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "token-123";
    process.env.WHATSAPP_RUNTIME_MODE = "banana";

    await expect(
      startServer({
        port: 0,
        host: "127.0.0.1",
      })
    ).rejects.toThrow("WHATSAPP_RUNTIME_MODE must be one of: sync, async");
  });
});