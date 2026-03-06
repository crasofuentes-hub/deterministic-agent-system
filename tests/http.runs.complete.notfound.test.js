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

test("runs: complete returns 404 NOT_FOUND for unknown runId (deterministic)", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r = await requestJson(base + "/runs/run_DOES_NOT_EXIST/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ output: { ok: true } }),
    });

    assert.equal(r.status, 404);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error.code, "NOT_FOUND");
  } finally {
    await running.close();
  }
});
