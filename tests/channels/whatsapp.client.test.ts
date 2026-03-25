import { describe, expect, it } from "vitest";
import { createMockWhatsAppSender } from "../../src/channels/whatsapp/client";
import { createHttpWhatsAppSender } from "../../src/channels/whatsapp/send-http";
import { buildWhatsAppTextOutbound } from "../../src/channels/whatsapp/send";

describe("whatsapp client", () => {
  it("sends deterministically in mock mode", async () => {
    const sender = createMockWhatsAppSender({
      acceptedAtIso: "2026-03-24T12:00:00.000Z",
      providerMessageId: "mock-msg-001",
    });

    const result = await sender.send(
      buildWhatsAppTextOutbound({
        to: "5215512345678",
        body: "Product: Laptop X Pro | Price: 1499.99 USD",
      })
    );

    expect(result).toEqual({
      ok: true,
      mode: "mock",
      providerMessageId: "mock-msg-001",
      acceptedAtIso: "2026-03-24T12:00:00.000Z",
    });
  });

  it("builds the correct HTTP request and parses provider message id", async () => {
    const calls: Array<{
      input: string;
      init: {
        method: string;
        headers: Record<string, string>;
        body: string;
      };
    }> = [];

    const sender = createHttpWhatsAppSender({
      apiVersion: "v22.0",
      phoneNumberId: "1234567890",
      accessToken: "test-token-001",
      fetchImpl: async (input, init) => {
        calls.push({ input, init });

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              messaging_product: "whatsapp",
              contacts: [{ input: "5215512345678", wa_id: "5215512345678" }],
              messages: [{ id: "wamid.http.001" }],
            };
          },
        };
      },
    });

    const payload = buildWhatsAppTextOutbound({
      to: "5215512345678",
      body: "Product: Laptop X Pro | Price: 1499.99 USD",
    });

    const result = await sender.send(payload);

    expect(calls).toEqual([
      {
        input: "https://graph.facebook.com/v22.0/1234567890/messages",
        init: {
          method: "POST",
          headers: {
            authorization: "Bearer test-token-001",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      },
    ]);

    expect(result).toEqual({
      ok: true,
      mode: "http",
      providerMessageId: "wamid.http.001",
      acceptedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("returns a typed failure on non-2xx HTTP response", async () => {
    const sender = createHttpWhatsAppSender({
      apiVersion: "v22.0",
      phoneNumberId: "1234567890",
      accessToken: "test-token-001",
      fetchImpl: async () => {
        return {
          ok: false,
          status: 401,
          async json() {
            return {
              error: {
                message: "Invalid OAuth access token.",
              },
            };
          },
        };
      },
    });

    const result = await sender.send(
      buildWhatsAppTextOutbound({
        to: "5215512345678",
        body: "Hola",
      })
    );

    expect(result).toEqual({
      ok: false,
      mode: "http",
      error: "whatsapp http send failed",
      statusCode: 401,
    });
  });

  it("rejects invalid HTTP sender configuration", () => {
    expect(() =>
      createHttpWhatsAppSender({
        apiVersion: "v22.0",
        phoneNumberId: "1234567890",
        accessToken: "   ",
        fetchImpl: async () => {
          throw new Error("should not be called");
        },
      })
    ).toThrow("accessToken must be a non-empty string");
  });
});
