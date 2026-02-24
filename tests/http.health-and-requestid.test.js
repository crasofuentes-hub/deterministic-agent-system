const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function testHealthOk() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/health", {
      method: "GET",
    });

    assert.equal(r.status, 200);
    assert.ok(r.json);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.result.service, "deterministic-agent-system-http");
    assert.equal(r.json.result.status, "ok");

    const requestId = r.headers.get("x-request-id");
    assert.equal(typeof requestId, "string");
    assert.ok(requestId && requestId.length > 0);
    assert.equal(r.json.meta.requestId, requestId);
  } finally {
    await running.close();
  }
}

async function testHealthMethodNotAllowed() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    assert.equal(r.status, 405);

    const requestId = r.headers.get("x-request-id");
    assert.equal(typeof requestId, "string");
    assert.ok(requestId && requestId.length > 0);
  } finally {
    await running.close();
  }
}

async function testKnownEndpointHasRequestId() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "health-request-id-check",
        topK: 2,
        maxTokens: 16,
        traceId: "health-reqid-001",
      }),
    });

    assert.equal(r.status, 200);
    assert.ok(r.json);
    assert.equal(r.json.ok, true);

    const requestId = r.headers.get("x-request-id");
    assert.equal(typeof requestId, "string");
    assert.ok(requestId && requestId.length > 0);
  } finally {
    await running.close();
  }
}

async function main() {
  await testHealthOk();
  await testHealthMethodNotAllowed();
  await testKnownEndpointHasRequestId();
  console.log("http.health-and-requestid.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
