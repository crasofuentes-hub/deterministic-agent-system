import { describe, expect, it } from "vitest";
import { resolveWhatsAppRuntime } from "../../src/channels/whatsapp/runtime";
import { buildWhatsAppTextOutbound } from "../../src/channels/whatsapp/send";

describe("whatsapp runtime", () => {
  it("resolves skipped mode by default", () => {
    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
      },
    });

    expect(runtime).toEqual({
      verifyToken: "verify-token-001",
      deliveryMode: "skipped",
    });
  });

  it("resolves mock mode with sender", async () => {
    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_DELIVERY_MODE: "mock",
      },
    });

    expect(runtime.verifyToken).toBe("verify-token-001");
    expect(runtime.deliveryMode).toBe("mock");
    expect(runtime.sender).toBeDefined();

    const result = await runtime.sender!.send(
      buildWhatsAppTextOutbound({
        to: "5215512345678",
        body: "Hola desde mock",
      })
    );

    expect(result).toEqual({
      ok: true,
      mode: "mock",
      providerMessageId: "mocked-whatsapp-message-001",
      acceptedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("resolves http mode with injected fetch", async () => {
    const calls: Array<{
      input: string;
      init: {
        method: string;
        headers: Record<string, string>;
        body: string;
      };
    }> = [];

    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_DELIVERY_MODE: "http",
        WHATSAPP_API_VERSION: "v22.0",
        WHATSAPP_PHONE_NUMBER_ID: "1234567890",
        WHATSAPP_ACCESS_TOKEN: "access-token-001",
      },
      fetchImpl: async (input, init) => {
        calls.push({ input, init });

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              messages: [{ id: "wamid.runtime.001" }],
            };
          },
        };
      },
    });

    expect(runtime.verifyToken).toBe("verify-token-001");
    expect(runtime.deliveryMode).toBe("http");
    expect(runtime.sender).toBeDefined();

    const payload = buildWhatsAppTextOutbound({
      to: "5215512345678",
      body: "Hola desde http",
    });

    const result = await runtime.sender!.send(payload);

    expect(calls).toEqual([
      {
        input: "https://graph.facebook.com/v22.0/1234567890/messages",
        init: {
          method: "POST",
          headers: {
            authorization: "Bearer access-token-001",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      },
    ]);

    expect(result).toEqual({
      ok: true,
      mode: "http",
      providerMessageId: "wamid.runtime.001",
      acceptedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("rejects missing verify token", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {},
      })
    ).toThrow("WHATSAPP_VERIFY_TOKEN is required");
  });

  it("rejects invalid delivery mode", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "banana",
        },
      })
    ).toThrow("WHATSAPP_DELIVERY_MODE must be one of: skipped, mock, http");
  });

  it("rejects incomplete http configuration", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "http",
          WHATSAPP_API_VERSION: "v22.0",
        },
        fetchImpl: async () => {
          throw new Error("should not be called");
        },
      })
    ).toThrow("WHATSAPP_PHONE_NUMBER_ID is required for http mode");
  });
});
