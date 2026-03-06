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

test("runs: complete returns 409 when run is cancelled", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await createRun(base, "agent-complete-cancelled-001", { goal: "cancel-then-complete" });
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

    const completed = await requestJson(base + `/runs/${runId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ output: { ok: true } }),
    });

    assert.equal(completed.status, 409);
    assert.equal(completed.body.ok, false);
    assert.equal(completed.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});
