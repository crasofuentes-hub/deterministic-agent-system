import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSqliteWhatsAppStore } from "../../src/channels/whatsapp/store-sqlite";

function createTempDbPath(testName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dass-whatsapp-store-"));
  return path.join(dir, testName + ".sqlite");
}

describe("whatsapp sqlite store", () => {
  it("creates deterministic initial session when none exists", () => {
    const dbPath = createTempDbPath("initial-session");
    const store = createSqliteWhatsAppStore({
      dbPath,
      businessContextId: "customer-service-core-v2",
    });

    try {
      const session = store.loadSession("5215512345678");

      expect(session).toEqual({
        sessionId: "whatsapp-session:5215512345678",
        businessContextId: "customer-service-core-v2",
        currentIntentId: undefined,
        currentWorkflowId: undefined,
        currentStage: undefined,
        conversationStatus: "active",
        missingEntityIds: [],
        collectedEntities: [],
        turns: [],
        handoffRequested: false,
      });
    } finally {
      store.close();
    }
  });

  it("persists saved session across store reopen", () => {
    const dbPath = createTempDbPath("persist-session");

    {
      const store = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      const session = store.loadSession("5215512345678");
      const updated = {
        ...session,
        currentIntentId: "consult-price",
        conversationStatus: "waiting-user" as const,
        missingEntityIds: ["productName"],
      };

      store.saveSession("5215512345678", updated);
      store.close();
    }

    {
      const reopened = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      try {
        expect(reopened.loadSession("5215512345678")).toEqual({
          sessionId: "whatsapp-session:5215512345678",
          businessContextId: "customer-service-core-v2",
          currentIntentId: "consult-price",
          currentWorkflowId: undefined,
          currentStage: undefined,
          conversationStatus: "waiting-user",
          missingEntityIds: ["productName"],
          collectedEntities: [],
          turns: [],
          handoffRequested: false,
        });
      } finally {
        reopened.close();
      }
    }
  });

  it("persists processed message ids across reopen", () => {
    const dbPath = createTempDbPath("processed-message");

    {
      const store = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      expect(store.hasProcessedMessage("wamid.001")).toBe(false);
      store.markMessageProcessed("wamid.001");
      expect(store.hasProcessedMessage("wamid.001")).toBe(true);
      store.close();
    }

    {
      const reopened = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      try {
        expect(reopened.hasProcessedMessage("wamid.001")).toBe(true);
      } finally {
        reopened.close();
      }
    }
  });

  it("supports custom session id prefix", () => {
    const dbPath = createTempDbPath("custom-prefix");
    const store = createSqliteWhatsAppStore({
      dbPath,
      businessContextId: "customer-service-core-v2",
      sessionIdPrefix: "wa-session",
    });

    try {
      const session = store.loadSession("5215512345678");
      expect(session.sessionId).toBe("wa-session:5215512345678");
    } finally {
      store.close();
    }
  });

  it("rejects invalid options", () => {
    expect(() =>
      createSqliteWhatsAppStore({
        dbPath: "   ",
        businessContextId: "customer-service-core-v2",
      })
    ).toThrow("dbPath must be a non-empty string");

    expect(() =>
      createSqliteWhatsAppStore({
        dbPath: createTempDbPath("invalid-business-context"),
        businessContextId: "   ",
      })
    ).toThrow("businessContextId must be a non-empty string");
  });

  it("persists conversation evidence across store reopen", () => {
    const dbPath = createTempDbPath("persist-evidence");

    {
      const store = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      store.saveEvidence({
        customerId: "5215512345678",
        lastInboundMessageId: "wamid.quote.005",
        lastResponseId: "request-quote-resolved",
        lastResolvedIntentId: "request-quote",
        lastStage: "resolve-quote-intake",
        lastStatus: "resolved",
        lastOutboundText:
          "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Prior insurance status: insured. Driver count: 2. Preferred contact: call.",
        humanInterventionRequired: false,
        updatedAtIso: "2026-03-24T00:00:00.000Z",
      });

      store.close();
    }

    {
      const reopened = createSqliteWhatsAppStore({
        dbPath,
        businessContextId: "customer-service-core-v2",
      });

      try {
        expect(reopened.loadEvidence("5215512345678")).toEqual({
          customerId: "5215512345678",
          lastInboundMessageId: "wamid.quote.005",
          lastResponseId: "request-quote-resolved",
          lastResolvedIntentId: "request-quote",
          lastStage: "resolve-quote-intake",
          lastStatus: "resolved",
          lastOutboundText:
            "Quote intake started for Personal Auto Standard in CA. A broker can now continue with eligibility, underwriting review, and premium estimation. Vehicle use: commute. Prior insurance status: insured. Driver count: 2. Preferred contact: call.",
          humanInterventionRequired: false,
          updatedAtIso: "2026-03-24T00:00:00.000Z",
          handoffReasonCode: undefined,
          handoffQueue: undefined,
        });
      } finally {
        reopened.close();
      }
    }
  });
});