import { describe, expect, it } from "vitest";
import { resolveAsyncWhatsAppRuntime } from "../../src/channels/whatsapp/runtime-async";

describe("async whatsapp runtime postgres store preference", () => {
  it("prefers postgres when async runtime is enabled and store mode is omitted", async () => {
    await expect(
      resolveAsyncWhatsAppRuntime({
        env: {
          WHATSAPP_VERIFY_TOKEN: "verify-token",
          WHATSAPP_RUNTIME_MODE: "async",
        },
      }),
    ).rejects.toThrow("DATABASE_URL must be a non-empty string");
  });

  it("keeps memory available when explicitly requested for async local runs", async () => {
    const runtime = await resolveAsyncWhatsAppRuntime({
      env: {
        WHATSAPP_VERIFY_TOKEN: "verify-token",
        WHATSAPP_RUNTIME_MODE: "async",
        WHATSAPP_STORE_MODE: "memory",
      },
    });

    try {
      await expect(runtime.store.loadSession("5215512345678")).resolves.toMatchObject({
        sessionId: "whatsapp-session:5215512345678",
        businessContextId: "customer-service-core-v2",
        conversationStatus: "active",
      });
    } finally {
      await runtime.close();
    }
  });
});