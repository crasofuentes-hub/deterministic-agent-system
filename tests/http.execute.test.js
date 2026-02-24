const assert = require("node:assert/strict");
const { startServer } = require("../dist/src/http/server");

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { status: res.status, json, text };
}

async function testExecuteSuccess() {
  const running = await startServer({ port: 0 });

  try {
    const url = "http://127.0.0.1:" + running.port + "/execute";
    const body = {
      mode: "mock",
      maxSteps: 10,
      traceId: "http-test-001",
      plan: {
        planId: "http-plan-1",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "mode", value: "x" },
          { id: "b", kind: "increment", key: "n", value: 1 },
        ],
      },
    };

    const res = await postJson(url, body);
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
    assert.equal(typeof res.json.result.planHash, "string");
    assert.equal(typeof res.json.result.executionHash, "string");
    assert.equal(res.json.meta.mode, "mock");
  } finally {
    await running.close();
  }
}

async function testSameRequestSameHashes() {
  const running = await startServer({ port: 0 });

  try {
    const url = "http://127.0.0.1:" + running.port + "/execute";
    const body = {
      mode: "mock",
      maxSteps: 10,
      plan: {
        planId: "http-plan-2",
        version: 1,
        steps: [
          { id: "b", kind: "increment", key: "n", value: 2 },
          { id: "a", kind: "set", key: "k", value: "v" },
        ],
      },
    };

    const r1 = await postJson(url, body);
    const r2 = await postJson(url, body);

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.json.ok, true);
    assert.equal(r2.json.ok, true);
    assert.equal(r1.json.result.planHash, r2.json.result.planHash);
    assert.equal(r1.json.result.executionHash, r2.json.result.executionHash);
  } finally {
    await running.close();
  }
}

async function main() {
  await testExecuteSuccess();
  await testSameRequestSameHashes();
  console.log("http.execute.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
