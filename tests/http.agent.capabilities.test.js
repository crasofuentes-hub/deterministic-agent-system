const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, raw: text };
  }
  return { status: response.status, body };
}

test("http GET /agent/capabilities is deterministic and describes current agent surface", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r1 = await requestJson(base + "/agent/capabilities");
    const r2 = await requestJson(base + "/agent/capabilities");

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.deepEqual(r1.body, r2.body);

    assert.equal(r1.body.ok, true);
    assert.equal(r1.body.result.endpoint, "/agent/run");
    assert.ok(r1.body.result.planners.includes("det-tools"));
    assert.ok(r1.body.result.tools.includes("echo"));
    assert.ok(r1.body.result.tools.includes("math/add"));
  } finally {
    await running.close();
  }
});