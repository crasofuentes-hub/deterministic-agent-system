const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { parseError: true, raw: text }; }
  return { status: response.status, body };
}

async function checkDeterministic(base, path) {
  const r1 = await requestJson(base + path);
  const r2 = await requestJson(base + path);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.deepEqual(r1.body, r2.body);
  assert.equal(r1.body.ok, true);
  assert.ok(r1.body.result);
  return r1.body.result;
}

test("http GET /schema/* endpoints are deterministic", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const s1 = await checkDeterministic(base, "/schema/agent-run");
    assert.equal(s1.title, "POST /agent/run");

    const s2 = await checkDeterministic(base, "/schema/agent-capabilities");
    assert.equal(s2.title, "GET /agent/capabilities");

    const s3 = await checkDeterministic(base, "/schema/replay-bundle");
    assert.equal(s3.title, "Replay bundle (v1/v2)");
  } finally {
    await running.close();
  }
});