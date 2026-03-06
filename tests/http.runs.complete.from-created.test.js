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

test("runs: complete from CREATED returns 409 INVALID_RUN_TRANSITION (deterministic)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-complete-created-001", input: { goal: "complete-from-created" } }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    // complete without start -> conflict
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
