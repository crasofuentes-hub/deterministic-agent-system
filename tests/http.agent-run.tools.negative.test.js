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

test("http POST /agent/run det-tools returns TOOL_NOT_FOUND deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const body = {
      goal: "missingtool",
      demo: "core",
      mode: "mock",
      planner: "det-tools",
      maxSteps: 8,
      traceId: "trace-neg-001"
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

    assert.equal(r1.body.ok, false);
    assert.equal(r2.body.ok, false);

    assert.deepEqual(r1.body, r2.body);
    assert.equal(r1.body.error.code, "TOOL_NOT_FOUND");
  } finally {
    await running.close();
  }
});