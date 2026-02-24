const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function testSimulateSuccess() {
  const running = await startServer({ port: 0 });
  try {
    const url = "http://127.0.0.1:" + running.port + "/simulate";
    const body = {
      prompt: "deterministic execution trace",
      topK: 2,
      maxTokens: 32,
      traceId: "sim-001"
    };

    const r = await post(url, body);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meta.mode, "mock");
    assert.equal(typeof r.json.result.executionHashLike, "string");
    assert.equal(r.json.result.executionHashLike.startsWith("sx"), true);
    assert.equal(Array.isArray(r.json.result.retrieval.hits), true);
    assert.equal(Array.isArray(r.json.result.stream.events), true);
  } finally {
    await running.close();
  }
}

async function testSimulateDeterministic() {
  const running = await startServer({ port: 0 });
  try {
    const url = "http://127.0.0.1:" + running.port + "/simulate";
    const body = {
      prompt: "vector adapter portable integration contracts",
      topK: 2,
      maxTokens: 16
    };

    const r1 = await post(url, body);
    const r2 = await post(url, body);

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.json.ok, true);
    assert.equal(r2.json.ok, true);
    assert.equal(r1.json.result.executionHashLike, r2.json.result.executionHashLike);
    assert.deepEqual(r1.json.result.retrieval, r2.json.result.retrieval);
    assert.equal(r1.json.result.model.text, r2.json.result.model.text);
  } finally {
    await running.close();
  }
}

async function testSimulateInvalidRequest() {
  const running = await startServer({ port: 0 });
  try {
    const url = "http://127.0.0.1:" + running.port + "/simulate";
    const r = await post(url, { prompt: "", topK: 0, maxTokens: 0 });
    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "INVALID_REQUEST");
  } finally {
    await running.close();
  }
}

async function main() {
  await testSimulateSuccess();
  await testSimulateDeterministic();
  await testSimulateInvalidRequest();
  console.log("http.simulate.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});