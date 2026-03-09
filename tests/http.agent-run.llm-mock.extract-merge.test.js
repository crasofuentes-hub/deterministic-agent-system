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

test("http POST /agent/run planner=llm-mock chains normalize -> extract -> merge", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "extract and merge user data",
      demo: "core",
      mode: "mock",
      planner: "llm-mock",
      maxSteps: 12,
      traceId: "trace-llm-mock-extract-merge-001"
    };

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.result.planId, "agent-run-llm-mock-v1:extract-merge");
    assert.equal(r.body.result.finalState.values.merged, "{\"value\":{\"name\":\"Oscar\",\"role\":\"inventor\",\"source\":\"llm-mock\",\"workflow\":\"extract-merge\"}}");
  } finally {
    await running.close();
  }
});