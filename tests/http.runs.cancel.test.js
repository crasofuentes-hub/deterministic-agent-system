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

async function createRun(base, agentId, input) {
  const body = { agentId };
  if (typeof input !== "undefined") body.input = input;

  return await requestJson(base + "/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("runs: cancel is idempotent for CREATED run", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await createRun(base, "agent-test-001", { goal: "cancel-test" });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);

    const runId = created.body.result.runId;
    assert.equal(typeof runId, "string");
    assert.ok(runId.length > 0);

    const c1 = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "user_request" }),
    });
    assert.equal(c1.status, 200);
    assert.equal(c1.body.ok, true);
    assert.equal(c1.body.result.status, "cancelled");

    const c2 = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "user_request" }),
    });

    // requerimos idempotencia
    assert.equal(c2.status, 200);
    assert.equal(c2.body.ok, true);
    assert.equal(c2.body.result.status, "cancelled");
    assert.equal(c2.body.result.runId, runId);
  } finally {
    await running.close();
  }
});

test("runs: cancel after complete is rejected deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await createRun(base, "agent-test-002", { goal: "complete-then-cancel" });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);

    const runId = created.body.result.runId;

    const started = await requestJson(base + `/runs/${runId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.ok, true);
    assert.equal(started.body.result.status, "running");

    const completed = await requestJson(base + `/runs/${runId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ output: { ok: true } }),
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.ok, true);
    assert.equal(completed.body.result.status, "completed");

    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "late" }),
    });

    assert.equal(cancelled.status, 409);
    assert.equal(cancelled.body.ok, false);
    assert.equal(cancelled.body.error.code, "INVALID_RUN_TRANSITION");
  } finally {
    await running.close();
  }
});