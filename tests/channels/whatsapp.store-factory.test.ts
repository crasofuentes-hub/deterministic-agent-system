import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWhatsAppStore, parseWhatsAppStoreBackend } from "../../src/channels/whatsapp/store-factory";

function createTempDbPath(name: string): string {
  return join(tmpdir(), "det-agent-" + name + "-" + process.pid + "-" + Date.now() + ".sqlite");
}

describe("whatsapp store factory", () => {
  it("defaults to the in-memory backend deterministically", () => {
    expect(parseWhatsAppStoreBackend(undefined)).toBe("memory");
    expect(parseWhatsAppStoreBackend(" memory ")).toBe("memory");
    expect(parseWhatsAppStoreBackend("SQLITE")).toBe("sqlite");
    expect(parseWhatsAppStoreBackend("postgres")).toBe("postgres");
  });

  it("rejects unsupported backends deterministically", () => {
    expect(() => parseWhatsAppStoreBackend("redis")).toThrow(
      "WHATSAPP_STORE_BACKEND must be one of: memory, sqlite, postgres"
    );
  });

  it("creates an in-memory whatsapp store", () => {
    const created = createWhatsAppStore({
      backend: "memory",
      businessContextId: "customer-service-core-v2",
    });

    try {
      expect(created.backend).toBe("memory");
      expect(created.store.loadSession("5215512345678").sessionId).toBe(
        "whatsapp-session:5215512345678"
      );
    } finally {
      created.close();
    }
  });

  it("creates a sqlite whatsapp store through the common factory", () => {
    const dbPath = createTempDbPath("whatsapp-store-factory");

    try {
      const created = createWhatsAppStore({
        backend: "sqlite",
        businessContextId: "customer-service-core-v2",
        sqliteDbPath: dbPath,
      });

      try {
        const session = created.store.loadSession("5215512345678");
        const updated = {
          ...session,
          currentIntentId: "consult-coverage",
          currentStage: "resolve-coverage",
        };

        created.store.saveSession("5215512345678", updated);
        expect(created.store.loadSession("5215512345678")).toEqual(updated);
      } finally {
        created.close();
      }
    } finally {
      if (existsSync(dbPath)) {
        rmSync(dbPath, { force: true });
      }
    }
  });

  it("requires a sqlite database path for sqlite backend", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "sqlite",
        businessContextId: "customer-service-core-v2",
      })
    ).toThrow("sqliteDbPath must be a non-empty string");
  });

  it("keeps postgres backend explicit until the adapter is implemented", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "postgres",
        businessContextId: "customer-service-core-v2",
        postgres: {
          DATABASE_URL: "postgres://user:pass@localhost:5432/deterministic_agent_system",
        },
      })
    ).toThrow("postgres whatsapp store is not implemented yet");
  });

  it("validates postgres config before reporting adapter availability", () => {
    expect(() =>
      createWhatsAppStore({
        backend: "postgres",
        businessContextId: "customer-service-core-v2",
      })
    ).toThrow("DATABASE_URL must be a non-empty string");
  });
});