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

test("runs: start unknown runId returns 404 NOT_FOUND deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r1 = await requestJson(base + "/runs/run_DOES_NOT_EXIST/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const r2 = await requestJson(base + "/runs/run_DOES_NOT_EXIST/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(r1.status, 404);
    assert.equal(r2.status, 404);

    assert.equal(r1.body.ok, false);
    assert.equal(r2.body.ok, false);

    assert.equal(r1.body.error.code, "NOT_FOUND");
    assert.equal(r2.body.error.code, "NOT_FOUND");

    // determinismo de payload (except requestId)
    assert.equal(r1.body.error.message, r2.body.error.message);
  } finally {
    await running.close();
  }
});
