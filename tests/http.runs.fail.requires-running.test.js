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

test("runs: fail returns 409 when run is still CREATED (deterministic)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-fail-created-001", input: { goal: "fail-without-start" } }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    // fail without start -> conflict
    const failed = await requestJson(base + `/runs/${runId}/fail`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "TEST_FAIL", message: "fail-without-start" }),
    });

    assert.equal(failed.status, 409);
    assert.equal(failed.body.ok, false);
    assert.equal(failed.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});
