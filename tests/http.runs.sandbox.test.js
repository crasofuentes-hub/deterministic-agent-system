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

test("http /runs/:id/execute runs sandbox.* steps deterministically (mock adapter)", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const created = await requestJson(base + "/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "agent-sandbox-mock" })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    const runId = created.body.result.runId;

    const plan = {
      planId: "sandbox-plan-1",
      version: 1,
      steps: [
        { id: "s1", kind: "sandbox.open", sessionId: "sessA", url: "https://example.test" },
        { id: "s2", kind: "sandbox.click", sessionId: "sessA", selector: "#login" },
        { id: "s3", kind: "sandbox.type", sessionId: "sessA", selector: "#user", text: "alice" },
        { id: "s4", kind: "sandbox.extract", sessionId: "sessA", selector: "#msg", outputKey: "extracted" }
      ]
    };

    const executed = await requestJson(base + "/runs/" + runId + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mock",
        maxSteps: 20,
        traceId: "sandbox-http-001",
        plan
      })
    });

    assert.equal(executed.status, 200);
assert.equal(executed.body.ok, true);
    assert.equal(executed.body.result.status, "completed");

    const out = executed.body.result.output;
    assert.equal(typeof out, "object");
    assert.equal(out !== null, true);

    const exec = out.execution;
    assert.equal(typeof exec, "object");
    assert.equal(exec !== null, true);

    assert.equal(exec.ok, true);
    assert.equal(typeof exec.result, "object");
    assert.equal(exec.result !== null, true);

    const finalState = exec.result.finalState;
    assert.equal(typeof finalState, "object");
    assert.equal(finalState !== null, true);

    assert.equal(finalState.values.extracted, "mock:#msg");
  } finally {
    await running.close();
  }
});


