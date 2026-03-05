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

test("http POST /agent/run planner=det-replan2 re-plans deterministically using TOOL_* reason", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "missingtool",
      demo: "core",
      mode: "mock",
      planner: "det-replan2",
      maxSteps: 12,
      traceId: "trace-replan2-001"
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

    assert.equal(r1.body.result.finalState.values.output, "{\"value\":\"replan2:TOOL_NOT_FOUND\"}");
    const logs = r1.body.result.finalState.logs.join("\n");
    assert.ok(logs.includes("replan2:TOOL_NOT_FOUND"));
  } finally {
    await running.close();
  }
});