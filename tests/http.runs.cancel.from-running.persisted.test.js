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
  return { status: response.status, headers: response.headers, body };
}

test("runs: cancel from RUNNING persists cancelled and GET reflects it deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-cancel-from-running-001",
        input: { goal: "cancel-from-running" }
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    // start -> running
    const started = await requestJson(base + `/runs/${runId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.ok, true);
    assert.equal(started.body.result.status, "running");

    // cancel
    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "user_request" }),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.ok, true);
    assert.equal(cancelled.body.result.status, "cancelled");
    assert.equal(cancelled.body.result.runId, runId);

    // GET reflects cancelled
    const fetched = await requestJson(base + `/runs/${runId}`, { method: "GET" });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.ok, true);
    assert.equal(fetched.body.result.runId, runId);
    assert.equal(fetched.body.result.status, "cancelled");

    // determinismo básico: reason debe persistir como RUN_CANCELLED con message
    assert.equal(typeof fetched.body.result.error, "object");
    assert.equal(fetched.body.result.error.code, "RUN_CANCELLED");
    assert.equal(fetched.body.result.error.message, "user_request");
  } finally {
    await running.close();
  }
});
