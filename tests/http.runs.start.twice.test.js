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

test("runs: start twice returns 409 INVALID_RUN_TRANSITION (deterministic)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-start-twice-001", input: { goal: "start-twice" } }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    // first start ok
    const s1 = await requestJson(base + `/runs/${runId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(s1.status, 200);
    assert.equal(s1.body.ok, true);
    assert.equal(s1.body.result.status, "running");

    // second start -> conflict
    const s2 = await requestJson(base + `/runs/${runId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(s2.status, 409);
    assert.equal(s2.body.ok, false);
    assert.equal(s2.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});
