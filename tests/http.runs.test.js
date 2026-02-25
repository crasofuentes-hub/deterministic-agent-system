const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text.length ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  return { status: res.status, headers: res.headers, body };
}

test("http /runs lifecycle create -> get -> start -> complete", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-demo",
        input: { task: "demo" },
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    assert.equal(typeof created.body.result.runId, "string");
    assert.equal(created.body.result.agentId, "agent-demo");
    assert.equal(created.body.result.status, "created");

    const runId = created.body.result.runId;

    const fetched = await requestJson(base + "/runs/" + runId, {
      method: "GET",
    });

    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.ok, true);
    assert.equal(fetched.body.result.runId, runId);
    assert.equal(fetched.body.result.status, "created");

    const started = await requestJson(base + "/runs/" + runId + "/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(started.status, 200);
    assert.equal(started.body.ok, true);
    assert.equal(started.body.result.runId, runId);
    assert.equal(started.body.result.status, "running");

    const completed = await requestJson(base + "/runs/" + runId + "/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        output: { ok: true, value: 42 },
      }),
    });

    assert.equal(completed.status, 200);
    assert.equal(completed.body.ok, true);
    assert.equal(completed.body.result.runId, runId);
    assert.equal(completed.body.result.status, "completed");
    assert.deepEqual(completed.body.result.output, { ok: true, value: 42 });
  } finally {
    await running.close();
  }
});

test("http /runs/:id returns 404 for unknown run", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;
    const r = await requestJson(base + "/runs/run_999999", { method: "GET" });

    assert.equal(r.status, 404);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error.code, "NOT_FOUND");
  } finally {
    await running.close();
  }
});

test("http /runs lifecycle returns 409 on invalid transition", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-invalid-transition",
      }),
    });

    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const started = await requestJson(base + "/runs/" + runId + "/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.result.status, "running");

    const completed = await requestJson(base + "/runs/" + runId + "/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ output: { done: true } }),
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.result.status, "completed");

    const cancelled = await requestJson(base + "/runs/" + runId + "/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "too late" }),
    });

    assert.equal(cancelled.status, 409);
    assert.equal(cancelled.body.ok, false);
    assert.equal(cancelled.body.error.code, "INVALID_RUN_TRANSITION");
    assert.match(cancelled.body.error.message, /Invalid transition:/);
  } finally {
    await running.close();
  }
});

test("http /runs/:id/complete rejects GET with 405", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent-method-check",
      }),
    });

    assert.equal(created.status, 201);
    const runId = created.body.result.runId;

    const r = await requestJson(base + "/runs/" + runId + "/complete", {
      method: "GET",
    });

    assert.equal(r.status, 405);
    assert.equal(r.body.ok, false);
    assert.equal(typeof r.body.error.code, "string");
  } finally {
    await running.close();
  }
});
