const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");
const fs = require("node:fs");

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { parseError: true, raw: text }; }
  return { status: response.status, body };
}

test("http POST /agent/run planner=llm-live (openai-compatible stub via llmPlanText) is deterministic across repeats", async () => {
  try { fs.rmSync(".llm-live-cache", { recursive: true, force: true }); } catch {}

  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const llmPlanText = JSON.stringify({
      planId: "agent-run-llm-live-openai-stub-v1",
      version: 1,
      steps: [
        { id: "d", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
        { id: "b", kind: "set", key: "intent", value: "compute" },
        { id: "a", kind: "set", key: "goal", value: "sum 2 3" },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        { id: "e", kind: "append_log", value: "done" }
      ]
    });

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmModel: "gpt-test",
      llmTemperature: 0,
      llmMaxTokens: 256,
      llmPlanText,
      maxSteps: 12,
      traceId: "trace-llm-live-openai-stub-001"
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
    assert.equal(r1.body.result.finalState.values.sum, "{\"sum\":5}");
  } finally {
    await running.close();
  }
});