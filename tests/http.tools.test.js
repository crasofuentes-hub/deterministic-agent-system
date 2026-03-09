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

test("http GET /tools returns deterministic tool registry", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r1 = await requestJson(base + "/tools");
    const r2 = await requestJson(base + "/tools");

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.deepEqual(r1.body, r2.body);

    assert.equal(r1.body.ok, true);
    assert.ok(Array.isArray(r1.body.result.tools));

    const tools = r1.body.result.tools;
    const ids = tools.map((t) => t.id);
    const sorted = ids.slice().sort();
    assert.deepEqual(ids, sorted);

    assert.deepEqual(ids, [
      "echo",
      "json/extract",
      "json/merge",
      "json/select-keys",
      "math/add",
      "text/normalize"
    ]);

    for (const tool of tools) {
      assert.equal(typeof tool.id, "string");
      assert.equal(tool.version, 1);
      assert.equal(typeof tool.pluginId, "string");
      assert.equal(tool.pluginVersion, 1);
      assert.equal(typeof tool.displayName, "string");
      assert.equal(typeof tool.description, "string");
      assert.ok(Array.isArray(tool.capabilities));
      assert.equal(tool.inputSchemaHint.type, "object");
      assert.ok(Array.isArray(tool.inputSchemaHint.required));
    }
  } finally {
    await running.close();
  }
});