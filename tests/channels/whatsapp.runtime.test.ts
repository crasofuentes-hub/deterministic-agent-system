import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWhatsAppRuntime } from "../../src/channels/whatsapp/runtime";
import { buildWhatsAppTextOutbound } from "../../src/channels/whatsapp/send";

function createTempDbPath(testName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dass-whatsapp-runtime-"));
  return path.join(dir, testName + ".sqlite");
}

describe("whatsapp runtime", () => {
  it("resolves skipped mode with memory store by default", () => {
    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
      },
    });

    expect(runtime.verifyToken).toBe("verify-token-001");
    expect(runtime.deliveryMode).toBe("skipped");
    expect(runtime.sender).toBeUndefined();
    expect(runtime.store.loadSession("5215512345678").sessionId).toBe(
      "whatsapp-session:5215512345678"
    );
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

    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("https://graph.facebook.com/v22.0/1234567890/messages");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      authorization: "Bearer access-token-001",
      "content-type": "application/json",
    });
    expect(calls[0].init.body).toBe(JSON.stringify(payload));
    expect(calls[0].init.signal).toBeDefined();

    expect(result).toEqual({
      ok: true,
      mode: "http",
      providerMessageId: "wamid.runtime.001",
      acceptedAtIso: "2026-03-24T00:00:00.000Z",
    });
  });

  it("resolves sqlite store mode", () => {
    const dbPath = createTempDbPath("runtime-sqlite");
    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_STORE_MODE: "sqlite",
        WHATSAPP_SQLITE_PATH: dbPath,
      },
    });

    const session = runtime.store.loadSession("5215512345678");
    expect(session.sessionId).toBe("whatsapp-session:5215512345678");

    runtime.store.markMessageProcessed("wamid.runtime.sqlite.001");
    expect(runtime.store.hasProcessedMessage("wamid.runtime.sqlite.001")).toBe(true);

    if ("close" in runtime.store && typeof runtime.store.close === "function") {
      runtime.store.close();
    }
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

  it("rejects invalid store mode", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_STORE_MODE: "banana",
        },
      })
    ).toThrow("WHATSAPP_STORE_MODE must be one of: memory, sqlite");
  });

  it("rejects incomplete sqlite configuration", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_STORE_MODE: "sqlite",
        },
      })
    ).toThrow("WHATSAPP_SQLITE_PATH is required for sqlite store mode");
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

  it("requires WHATSAPP_API_VERSION for http delivery mode", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "http",
          WHATSAPP_PHONE_NUMBER_ID: "1234567890",
          WHATSAPP_ACCESS_TOKEN: "token-001",
        },
      })
    ).toThrow("WHATSAPP_API_VERSION is required for http mode");
  });

  it("requires WHATSAPP_PHONE_NUMBER_ID for http delivery mode", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "http",
          WHATSAPP_API_VERSION: "v23.0",
          WHATSAPP_ACCESS_TOKEN: "token-001",
        },
      })
    ).toThrow("WHATSAPP_PHONE_NUMBER_ID is required for http mode");
  });

  it("requires WHATSAPP_ACCESS_TOKEN for http delivery mode", () => {
    expect(() =>
      resolveWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token-001",
          WHATSAPP_DELIVERY_MODE: "http",
          WHATSAPP_API_VERSION: "v23.0",
          WHATSAPP_PHONE_NUMBER_ID: "1234567890",
        },
      })
    ).toThrow("WHATSAPP_ACCESS_TOKEN is required for http mode");
  });

  it("creates runtime successfully for http delivery mode when required vars are present", () => {
    const runtime = resolveWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token-001",
        WHATSAPP_DELIVERY_MODE: "http",
        WHATSAPP_API_VERSION: "v23.0",
        WHATSAPP_PHONE_NUMBER_ID: "1234567890",
        WHATSAPP_ACCESS_TOKEN: "token-001",
      },
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ messages: [{ id: "wamid.test.001" }] }),
          text: async () => "",
        }) as Response,
    });

    expect(runtime.verifyToken).toBe("verify-token-001");
    expect(runtime.deliveryMode).toBe("http");
    expect(runtime.sender).toBeDefined();
    expect(runtime.store).toBeDefined();
    expect(typeof runtime.store.loadSession).toBe("function");
    expect(typeof runtime.store.saveSession).toBe("function");
    expect(typeof runtime.store.hasProcessedMessage).toBe("function");
    expect(typeof runtime.store.markMessageProcessed).toBe("function");
  });
});
