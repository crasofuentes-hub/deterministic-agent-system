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

test("http POST /agent/run planner=llm-live openai-compatible returns deterministic config error", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      maxSteps: 12,
      traceId: "trace-llm-live-openai-compatible-config-001"
    };

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, false);
    assert.deepEqual(r.body.error, {
      code: "LLM_LIVE_NOT_CONFIGURED",
      message: "llm_live_not_configured",
      retryable: false
    });
  } finally {
    await running.close();
  }
});