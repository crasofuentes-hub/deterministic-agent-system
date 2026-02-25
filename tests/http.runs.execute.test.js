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

function makePlan() {
  return {
    planId: "g3-http-runs-execute-plan",
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "mode", value: "g3" },
      { id: "b", kind: "increment", key: "n", value: 1 }
    ]
  };
}

test("http /runs/:id/execute completes run and persists final state", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-g3-execute",
        input: { scenario: "happy" }
      })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    const executed = await requestJson(base + "/runs/" + runId + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 4,
        traceId: "trace-g3-001",
        plan: makePlan()
      })
    });

    assert.equal(executed.status, 200);
    assert.equal(executed.body.ok, true);
    assert.equal(executed.body.result.runId, runId);
    assert.equal(executed.body.result.status, "completed");
    assert.equal(typeof executed.body.result.updatedAt, "string");
    assert.equal(typeof executed.body.result.output, "object");
    assert.equal(executed.body.result.output !== null, true);

    const fetched = await requestJson(base + "/runs/" + runId, { method: "GET" });

    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.ok, true);
    assert.equal(fetched.body.result.runId, runId);
    assert.equal(fetched.body.result.status, "completed");
    assert.equal(typeof fetched.body.result.output, "object");
    assert.equal(fetched.body.result.output !== null, true);
  } finally {
    await running.close();
  }
});

test("http /runs/:id/execute returns 409 when run is already finalized", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-g3-execute-conflict"
      })
    });

    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const first = await requestJson(base + "/runs/" + runId + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 4,
        plan: makePlan()
      })
    });

    assert.equal(first.status, 200);
    assert.equal(first.body.ok, true);
    assert.equal(first.body.result.status, "completed");

    const second = await requestJson(base + "/runs/" + runId + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 4,
        plan: makePlan()
      })
    });

    assert.equal(second.status, 409);
    assert.equal(second.body.ok, false);
    assert.equal(second.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});


