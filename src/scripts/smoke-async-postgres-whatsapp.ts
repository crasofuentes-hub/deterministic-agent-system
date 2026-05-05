import { strict as assert } from "node:assert";
import { Pool } from "pg";
import { startServer } from "../http/server";

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();

  if (value.length === 0) {
    throw new Error(
      name +
        " is required. Example: postgres://det_agent:det_agent@localhost:5432/deterministic_agent_system"
    );
  }

  return value;
}

function configureSmokeEnvironment(): void {
  process.env.WHATSAPP_VERIFY_TOKEN = "local-smoke-token";
  process.env.WHATSAPP_RUNTIME_MODE = "async";
  process.env.WHATSAPP_STORE_MODE = "postgres";
  process.env.WHATSAPP_DELIVERY_MODE = "skipped";
  process.env.POSTGRES_MIGRATION_APPLIED_AT_ISO = "2026-03-24T00:00:00.000Z";
  process.env.WHATSAPP_PROCESSED_AT_ISO = "2026-03-24T00:00:00.000Z";
}

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

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");

  configureSmokeEnvironment();

  const runId = String(Date.now());
  const messageId = "wamid.local.async.postgres.coverage." + runId;
  const server = await startServer({ port: 0, host: "127.0.0.1" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const baseUrl = "http://" + server.host + ":" + server.port;

    const verifyResponse = await fetch(
      baseUrl +
        "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=local-smoke-token&hub.challenge=async-postgres-ok"
    );

    assert.equal(verifyResponse.status, 200);
    assert.equal(await verifyResponse.text(), "async-postgres-ok");

    const webhookResponse = await fetch(baseUrl + "/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-local-async-postgres-smoke-001",
      },
      body: buildInboundBody(messageId, "Coverage details for POL-AUTO-1001"),
    });

    assert.equal(webhookResponse.status, 200);

    const json = (await webhookResponse.json()) as {
      ok?: unknown;
      messagesReceived?: unknown;
      results?: Array<{
        duplicate?: unknown;
        agent?: {
          responseId?: unknown;
          resolvedIntentId?: unknown;
          stage?: unknown;
          status?: unknown;
          humanInterventionRequired?: unknown;
          outboundText?: unknown;
        };
      }>;
    };

    assert.equal(json.ok, true);
    assert.equal(json.messagesReceived, 1);
    assert.equal(json.results?.[0]?.duplicate, false);
    assert.equal(json.results?.[0]?.agent?.responseId, "consult-coverage-resolved");
    assert.equal(json.results?.[0]?.agent?.resolvedIntentId, "consult-coverage");
    assert.equal(json.results?.[0]?.agent?.stage, "resolve-coverage");
    assert.equal(json.results?.[0]?.agent?.status, "resolved");
    assert.equal(json.results?.[0]?.agent?.humanInterventionRequired, false);
    assert.match(String(json.results?.[0]?.agent?.outboundText ?? ""), /Policy NMA-\*\*\*\*-1001 for Maria Alvarez/);
    assert.match(String(json.results?.[0]?.agent?.outboundText ?? ""), /Carrier: Northwind Mutual Auto/);
    assert.match(String(json.results?.[0]?.agent?.outboundText ?? ""), /Selected coverages: 7 of 8/);

    const evidenceResult = await pool.query(
      "SELECT evidence_json FROM whatsapp_conversation_evidence WHERE customer_id = $1",
      ["5215512345678"]
    );

    assert.equal(evidenceResult.rows.length, 1);

    const evidence = evidenceResult.rows[0]?.evidence_json as {
      customerId?: unknown;
      lastInboundMessageId?: unknown;
      lastResponseId?: unknown;
      lastResolvedIntentId?: unknown;
      lastStage?: unknown;
      lastStatus?: unknown;
      humanInterventionRequired?: unknown;
    };

    assert.equal(evidence.customerId, "5215512345678");
    assert.equal(evidence.lastInboundMessageId, messageId);
    assert.equal(evidence.lastResponseId, "consult-coverage-resolved");
    assert.equal(evidence.lastResolvedIntentId, "consult-coverage");
    assert.equal(evidence.lastStage, "resolve-coverage");
    assert.equal(evidence.lastStatus, "resolved");
    assert.equal(evidence.humanInterventionRequired, false);

    console.log("ASYNC POSTGRES WHATSAPP SMOKE PASSED");
  } finally {
    await pool.end();
    await server.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});