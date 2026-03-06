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

async function createRun(base, agentId, input) {
  const body = { agentId };
  if (typeof input !== "undefined") body.input = input;
  return await requestJson(base + "/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("runs: fail returns 409 when run is cancelled", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await createRun(base, "agent-fail-cancelled-001", { goal: "cancel-then-fail" });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "user_request" }),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.ok, true);
    assert.equal(cancelled.body.result.status, "cancelled");

    const failed = await requestJson(base + `/runs/${runId}/fail`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "X", message: "late" }),
    });

    assert.equal(failed.status, 409);
    assert.equal(failed.body.ok, false);
    assert.equal(failed.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});
