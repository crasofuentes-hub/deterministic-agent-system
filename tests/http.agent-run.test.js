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

test("http POST /agent/run returns deterministic execution result", async () => {
  const running = await startServer({ port: 0 });
test("http POST /agent/run deterministic planner is stable across repeats", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "determinism-check",
      demo: "core",
      mode: "mock",
      planner: "deterministic",
      maxSteps: 8,
      traceId: "trace-det-001"
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

    // Determinismo: mismos hashes para mismas entradas (mock execution)
    assert.equal(r1.body.result.planHash, r2.body.result.planHash);
    assert.equal(r1.body.result.executionHash, r2.body.result.executionHash);
    assert.equal(r1.body.result.finalTraceLinkHash, r2.body.result.finalTraceLinkHash);
  } finally {
    await running.close();
  }
});

test("http POST /agent/run accepts planner=mock", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "hello",
        demo: "core",
        mode: "mock",
        planner: "mock",
        maxSteps: 8,
        traceId: "trace-mock-001"
      })
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  } finally {
    await running.close();
  }
});

  try {
    const base = "http://127.0.0.1:" + running.port;

    const r = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "demo",
        demo: "core",
        mode: "mock",
        maxSteps: 8,
        traceId: "trace-http-agent-run-001"
      }),
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(typeof r.body.result.planHash, "string");
    assert.equal(typeof r.body.result.executionHash, "string");
    assert.equal(typeof r.body.result.finalTraceLinkHash, "string");
  } finally {
    await running.close();
  }
});