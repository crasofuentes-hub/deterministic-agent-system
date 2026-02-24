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
  return { status: res.status, headers: res.headers, json, text };
}

async function testEchoHttpSuccess() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/tool/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "echo",
        input: { message: "hello-tool" },
        timeoutMs: 500,
        traceId: "http-tool-001"
      })
    });

    assert.equal(r.status, 200);
    assert.ok(r.json);
    assert.equal(r.json.ok, true);

    const requestId = r.headers.get("x-request-id");
    assert.equal(typeof requestId, "string");
    assert.ok(requestId && requestId.length > 0);

    assert.equal(r.json.result.tool.ok, true);
    assert.equal(r.json.result.tool.toolName, "echo");
    assert.equal(r.json.result.tool.output.echoed, "hello-tool");
  } finally {
    await running.close();
  }
}

async function testSumHttpSuccess() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/tool/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "sum",
        input: { values: [10, 20, 30] },
        timeoutMs: 500,
        traceId: "http-tool-002"
      })
    });

    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.result.tool.ok, true);
    assert.equal(r.json.result.tool.output.total, 60);
    assert.equal(r.json.result.tool.output.count, 3);
  } finally {
    await running.close();
  }
}

async function testToolNotFoundHttp() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/tool/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "does-not-exist",
        input: {},
        timeoutMs: 500
      })
    });

    assert.equal(r.status, 400);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.result.tool.ok, false);
    assert.equal(r.json.result.tool.error.code, "TOOL_NOT_FOUND");
  } finally {
    await running.close();
  }
}

async function testInvalidToolInputHttp() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/tool/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "sum",
        input: { values: [1, "bad", 3] },
        timeoutMs: 500
      })
    });

    assert.equal(r.status, 400);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.result.tool.ok, false);
    assert.equal(r.json.result.tool.error.code, "TOOL_INVALID_INPUT");
  } finally {
    await running.close();
  }
}

async function testHttpValidationError() {
  const running = await startServer({ port: 0 });
  try {
    const r = await requestJson("http://127.0.0.1:" + running.port + "/tool/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "",
        input: {}
      })
    });

    assert.equal(r.status, 400);
    assert.ok(r.json);
    assert.equal(r.json.ok, false);
  } finally {
    await running.close();
  }
}

async function main() {
  await testEchoHttpSuccess();
  await testSumHttpSuccess();
  await testToolNotFoundHttp();
  await testInvalidToolInputHttp();
  await testHttpValidationError();
  console.log("http.tool-execute.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});