const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, raw: text };
  }
  return { status: response.status, body };
}

test("runs: cancel persists status and error, and GET reflects it deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-cancel-persist-001", input: { goal: "persist-cancel" } })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    const reason = "user_request";
    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.ok, true);
    assert.equal(cancelled.body.result.runId, runId);
    assert.equal(cancelled.body.result.status, "cancelled");

    // Si se fija error en cancel, debe reflejarlo
    assert.equal(cancelled.body.result.error.code, "RUN_CANCELLED");
    assert.equal(cancelled.body.result.error.message, reason);

    const fetched = await requestJson(base + `/runs/${runId}`, { method: "GET" });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.ok, true);

    assert.equal(fetched.body.result.runId, runId);
    assert.equal(fetched.body.result.status, "cancelled");
    assert.equal(fetched.body.result.error.code, "RUN_CANCELLED");
    assert.equal(fetched.body.result.error.message, reason);
  } finally {
    await running.close();
  }
});
