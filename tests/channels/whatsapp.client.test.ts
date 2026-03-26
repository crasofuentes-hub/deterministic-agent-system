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
    const calls = [];

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

    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("https://graph.facebook.com/v22.0/1234567890/messages");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      authorization: "Bearer test-token-001",
      "content-type": "application/json",
    });
    expect(calls[0].init.body).toBe(JSON.stringify(payload));
    expect(calls[0].init.signal).toBeDefined();

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

  it("returns typed network failure when fetch throws", async () => {
    const sender = createHttpWhatsAppSender({
      apiVersion: "v22.0",
      phoneNumberId: "1234567890",
      accessToken: "test-token-001",
      fetchImpl: async () => {
        throw new Error("socket hang up");
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
      error: "whatsapp http send threw network error",
    });
  });

  it("returns typed timeout failure when fetch aborts", async () => {
    const sender = createHttpWhatsAppSender({
      apiVersion: "v22.0",
      phoneNumberId: "1234567890",
      accessToken: "test-token-001",
      timeoutMs: 50,
      fetchImpl: async (_input, init) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          init.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });

        return {
          ok: true,
          status: 200,
          async json() {
            return {};
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
      error: "whatsapp http send timed out",
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

    expect(() =>
      createHttpWhatsAppSender({
        apiVersion: "v22.0",
        phoneNumberId: "1234567890",
        accessToken: "token",
        timeoutMs: 0,
        fetchImpl: async () => {
          throw new Error("should not be called");
        },
      })
    ).toThrow("timeoutMs must be greater than 0");
  });
});
