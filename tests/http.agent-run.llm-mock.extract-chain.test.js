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

test("http POST /agent/run planner=llm-mock chains text/normalize -> json/extract", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "extract normalized user name from json",
      demo: "core",
      mode: "mock",
      planner: "llm-mock",
      maxSteps: 12,
      traceId: "trace-llm-mock-extract-chain-001"
    };

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.result.planId, "agent-run-llm-mock-v1:extract-chain");
    assert.equal(r.body.result.finalState.values.extracted, "{\"value\":\"Oscar\"}");
    assert.equal(typeof r.body.result.finalState.values.normalizedJson, "string");
  } finally {
    await running.close();
  }
});