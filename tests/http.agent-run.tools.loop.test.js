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

test("http POST /agent/run det-tools can run tool.loop and converge (deterministic)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "loop add 1 2",
      demo: "core",
      mode: "mock",
      planner: "det-tools",
      maxSteps: 12,
      traceId: "trace-det-tools-loop-001"
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

    assert.equal(r1.body.result.planHash, r2.body.result.planHash);
    assert.equal(r1.body.result.executionHash, r2.body.result.executionHash);
    assert.equal(r1.body.result.finalTraceLinkHash, r2.body.result.finalTraceLinkHash);

    assert.equal(r1.body.result.finalState.values.sum, "{\"sum\":3}");

    const logs = r1.body.result.finalState.logs.join("\n");
    assert.ok(logs.includes("tool.loop:i=0:tool=math/add:out=sum:fix=0"));
    assert.ok(logs.includes("fix=1"));
  } finally {
    await running.close();
  }
});