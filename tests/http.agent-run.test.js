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

test("http POST /agent/run returns deterministic execution result", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "demo",
        demo: "core",
        mode: "mock",
        maxSteps: 8,
        traceId: "trace-http-agent-run-001"
      }),
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(typeof r.body.result.planHash, "string");
    assert.equal(typeof r.body.result.executionHash, "string");
    assert.equal(typeof r.body.result.finalTraceLinkHash, "string");
  } finally {
    await running.close();
  }
});