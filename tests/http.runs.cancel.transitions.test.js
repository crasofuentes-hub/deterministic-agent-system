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

test("runs: cancel after fail is rejected (409) deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-cancel-after-fail-001", input: { goal: "fail-then-cancel" } }),
    });
    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const started = await requestJson(base + `/runs/${runId}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.result.status, "running");

    const failed = await requestJson(base + `/runs/${runId}/fail`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "E_FAIL", message: "boom" }),
    });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.result.status, "failed");

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

test("runs: cancel is idempotent and does not mutate error on second cancel", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-cancel-idempotent-001", input: { goal: "cancel-twice" } }),
    });
    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const c1 = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "first" }),
    });
    assert.equal(c1.status, 200);
    assert.equal(c1.body.result.status, "cancelled");
    assert.equal(c1.body.result.error.code, "RUN_CANCELLED");
    assert.equal(c1.body.result.error.message, "first");
    const updatedAt1 = c1.body.result.updatedAt;

    const c2 = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "second" }),
    });

    assert.equal(c2.status, 200);
    assert.equal(c2.body.result.status, "cancelled");

    // idempotencia fuerte: no se “re-escribe” el error
    assert.equal(c2.body.result.error.code, "RUN_CANCELLED");
    assert.equal(c2.body.result.error.message, "first");

    // opcional pero recomendado: no cambies updatedAt en re-cancel
    assert.equal(c2.body.result.updatedAt, updatedAt1);
  } finally {
    await running.close();
  }
});
