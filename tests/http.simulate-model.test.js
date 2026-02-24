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
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

async function testSimulateModelMockSuccess() {
  const running = await startServer({ port: 0 });
  try {
    const r = await post("http://127.0.0.1:" + running.port + "/simulate-model", {
      provider: "mock",
      prompt: "deterministic provider separation",
      maxTokens: 32,
      temperature: 0,
      traceId: "sim-model-001",
    });

    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.result.provider, "mock");
    assert.equal(r.json.result.orchestrationDeterministic, true);
    assert.equal(typeof r.json.result.orchestrationFingerprint, "string");
    assert.equal(r.json.result.model.deterministic, true);
  } finally {
    await running.close();
  }
}

async function testSimulateModelInvalidRequest() {
  const running = await startServer({ port: 0 });
  try {
    const r = await post("http://127.0.0.1:" + running.port + "/simulate-model", {
      provider: "invalid",
      prompt: "",
      maxTokens: 0,
    });

    assert.equal(r.status, 400);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, "INVALID_REQUEST");
  } finally {
    await running.close();
  }
}

async function main() {
  await testSimulateModelMockSuccess();
  await testSimulateModelInvalidRequest();
  console.log("http.simulate-model.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
