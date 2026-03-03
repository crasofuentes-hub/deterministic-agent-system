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

test("http POST /agent/run supports planner=det-tools (bounded loop, deterministic across repeats)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "sum-and-echo",
      demo: "core",
      mode: "mock",
      planner: "det-tools",
      maxSteps: 5,
      traceId: "trace-det-tools-001"
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

    // Debe ser DeterministicResponse-like
    assert.equal(r1.body && r1.body.ok, true);
    assert.equal(r2.body && r2.body.ok, true);

    // Determinismo fuerte: misma request => mismo JSON completo
    assert.deepEqual(r1.body, r2.body);

    // Shape mínimo del payload det-tools (run-tools.ts)
    assert.equal(r1.body.value.kind, "agent-tool-loop-v1");
    assert.equal(typeof r1.body.value.finalObservationHash, "string");
    assert.ok(Array.isArray(r1.body.value.steps));
    assert.ok(r1.body.value.termination === "fixpoint" || r1.body.value.termination === "max_iterations");
  } finally {
    await running.close();
  }
});