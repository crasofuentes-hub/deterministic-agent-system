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

test("http GET /tools exposes plugin contract metadata deterministically", async () => {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const r = await requestJson(base + "/tools");

    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);

    const tools = r.body.result.tools;
    const jsonMerge = tools.find((t) => t.id === "json/merge");

    assert.ok(jsonMerge);
    assert.equal(jsonMerge.pluginId, "builtin.json-merge");
    assert.equal(jsonMerge.pluginVersion, 1);
    assert.equal(jsonMerge.displayName, "JSON Merge");
    assert.deepEqual(jsonMerge.capabilities, ["json.merge"]);
    assert.deepEqual(jsonMerge.inputSchemaHint, {
      type: "object",
      required: ["left", "right"]
    });
  } finally {
    await running.close();
  }
});