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

async function createRun(base, agentId, input) {
  const body = { agentId };
  if (typeof input !== "undefined") body.input = input;
  return await requestJson(base + "/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("runs: cancel returns 409 when run is completed and GET preserves completed state", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await createRun(base, "agent-cancel-completed-001", { goal: "complete-then-cancel" });
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
      body: JSON.stringify({ output: { ok: true, value: 5 } }),
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.ok, true);
    assert.equal(completed.body.result.status, "completed");
    assert.deepEqual(completed.body.result.output, { ok: true, value: 5 });

    const updatedAtCompleted = completed.body.result.updatedAt;

    const cancelled = await requestJson(base + `/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "late_cancel" }),
    });

    assert.equal(cancelled.status, 409);
    assert.equal(cancelled.body.ok, false);
    assert.equal(cancelled.body.error.code, "INVALID_RUN_TRANSITION");

    const fetched = await requestJson(base + `/runs/${runId}`, { method: "GET" });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.ok, true);
    assert.equal(fetched.body.result.runId, runId);
    assert.equal(fetched.body.result.status, "completed");
    assert.deepEqual(fetched.body.result.output, { ok: true, value: 5 });
    assert.equal(fetched.body.result.updatedAt, updatedAtCompleted);
  } finally {
    await running.close();
  }
});