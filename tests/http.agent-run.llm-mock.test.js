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

test("http POST /agent/run planner=llm-mock is deterministic", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-mock",
      maxSteps: 12,
      traceId: "trace-llm-mock-001"
    };

    const r1 = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const r2 = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.body.ok, true);
    assert.equal(r2.body.ok, true);

    assert.equal(r1.body.result.planHash, r2.body.result.planHash);
    assert.equal(r1.body.result.executionHash, r2.body.result.executionHash);
    assert.equal(r1.body.result.finalTraceLinkHash, r2.body.result.finalTraceLinkHash);

    // sum debe ser 5
    assert.equal(r1.body.result.finalState.values.sum, "{\"sum\":5}");
  } finally {
    await running.close();
  }
});