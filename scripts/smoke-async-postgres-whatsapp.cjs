"use strict";

const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { startServer } = require("../dist/http/server");

function buildInboundBody(messageId, userText) {
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

async function main() {
  const runId = String(Date.now());
  const messageId = "wamid.local.async.postgres.coverage." + runId;
  const server = await startServer({ port: 0, host: "127.0.0.1" });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const baseUrl = "http://" + server.host + ":" + server.port;

    const verifyResponse = await fetch(
      baseUrl + "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=local-smoke-token&hub.challenge=async-postgres-ok"
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
    const json = await webhookResponse.json();

    assert.equal(json.ok, true);
    assert.equal(json.messagesReceived, 1);
    assert.equal(json.results[0].duplicate, false);
    assert.equal(json.results[0].agent.responseId, "consult-coverage-resolved");
    assert.equal(json.results[0].agent.resolvedIntentId, "consult-coverage");
    assert.equal(json.results[0].agent.stage, "resolve-coverage");
    assert.equal(json.results[0].agent.status, "resolved");
    assert.equal(json.results[0].agent.humanInterventionRequired, false);
    assert.match(json.results[0].agent.outboundText, /Policy NMA-\*\*\*\*-1001 for Maria Alvarez/);
    assert.match(json.results[0].agent.outboundText, /Carrier: Northwind Mutual Auto/);
    assert.match(json.results[0].agent.outboundText, /Selected coverages: 7 of 8/);

    const evidenceResult = await pool.query(
      "SELECT evidence_json FROM whatsapp_conversation_evidence WHERE customer_id = $1",
      ["5215512345678"]
    );

    assert.equal(evidenceResult.rows.length, 1);
    const evidence = evidenceResult.rows[0].evidence_json;
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});