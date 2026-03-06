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

test("runs: execute returns 409 when run is cancelled", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    // create
    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-cancel-exec-001", input: { goal: "cancel-then-exec" } }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    // cancel
    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "user_request" }),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.ok, true);
    assert.equal(cancelled.body.result.status, "cancelled");

    // execute should be rejected (registry.start should fail)
    const executed = await requestJson(base + `/runs/${runId}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 4,
        traceId: "trace-cancelled-exec-001",
        plan: {
          planId: "cancelled-exec-plan",
          version: 1,
          steps: [{ id: "a", kind: "append_log", value: "noop" }],
        },
      }),
    });

    assert.equal(executed.status, 409);
    assert.equal(executed.body.ok, false);
    assert.equal(executed.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});
