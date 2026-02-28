const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function req(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const requestId = res.headers.get("x-request-id");
  return { status: res.status, json, text, requestId };
}

async function testNotFound() {
  const running = await startServer({ port: 0 });
  try {
    const r = await req("http://127.0.0.1:" + running.port + "/unknown", { method: "GET" });
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "NOT_FOUND");
    assert.equal(r.json.meta.requestId, r.requestId);
  } finally {
    await running.close();
  }
}

async function testMethodNotAllowed() {
  const running = await startServer({ port: 0 });
  try {
    const r = await req("http://127.0.0.1:" + running.port + "/execute", { method: "GET" });
    assert.equal(r.status, 405);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "METHOD_NOT_ALLOWED");
    assert.equal(r.json.meta.requestId, r.requestId);
  } finally {
    await running.close();
  }
}

async function testMalformedJson() {
  const running = await startServer({ port: 0 });
  try {
    const r = await req("http://127.0.0.1:" + running.port + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad json",
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "MALFORMED_REQUEST");
    assert.equal(r.json.meta.requestId, r.requestId);
  } finally {
    await running.close();
  }
}

async function testInvalidRequest() {
  const running = await startServer({ port: 0 });
  try {
    const r = await req("http://127.0.0.1:" + running.port + "/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "mock", maxSteps: 0 }),
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "INVALID_REQUEST");
    assert.equal(r.json.meta.requestId, r.requestId);
  } finally {
    await running.close();
  }
}

async function main() {
  await testNotFound();
  await testMethodNotAllowed();
  await testMalformedJson();
  await testInvalidRequest();
  console.log("http.negative.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
