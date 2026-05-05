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

test("http POST /agent/run planner=llm-live openai-compatible returns deterministic invalid plan text error", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmPlanText: "{ invalid json",
      maxSteps: 12,
      traceId: "trace-llm-live-openai-compatible-invalid-plan-text-001"
    };

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error.code, "LLM_LIVE_INVALID_PLAN_TEXT");
    assert.equal(r.body.error.retryable, false);
    assert.match(r.body.error.message, /^llm_live_invalid_plan_text:/);
  } finally {
    await running.close();
  }
});