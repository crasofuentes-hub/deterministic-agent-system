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

function makePlan() {
  return {
    planId: "selfheal-plan-1",
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "mode", value: "selfheal" },
      { id: "b", kind: "increment", key: "n", value: 1 }
    ]
  };
}

test("http /runs/:id/execute self-heals with retries and converges <= 20", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-selfheal-http" })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    const executed = await requestJson(base + "/runs/" + runId + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 10,
        traceId: "FAIL_N_TIMES:2",
        plan: makePlan()
      })
    });

    assert.equal(executed.status, 200);
    assert.equal(executed.body.ok, true);
    assert.equal(executed.body.result.runId, runId);
    assert.equal(executed.body.result.status, "completed");

    const out = executed.body.result.output;
    assert.equal(typeof out, "object");
    assert.equal(out !== null, true);

    assert.equal(typeof out.metrics, "object");
    assert.equal(out.metrics !== null, true);

    assert.equal(out.metrics.fixpointIterations, 3);
    assert.equal(Array.isArray(out.metrics.backoffScheduleMs), true);
    assert.equal(out.metrics.backoffScheduleMs.length, 2);
  } finally {
    await running.close();
  }
});
