const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { parseError: true, raw: text }; }
  return { status: response.status, body };
}

test("runs: cancel returns 400 INVALID_REQUEST when reason is not string", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create run
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-cancel-badbody-001" }),
    });
    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const r = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: 123 }),
    });

    assert.equal(r.status, 400);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error.code, "INVALID_REQUEST");
  } finally {
    await running.close();
  }
});
