const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAgentToolRegistry,
  listAgentToolInfo,
} = require("../dist/src/agent/tools");

test("agent tool catalog yields deterministic registry and info", () => {
  const reg1 = createAgentToolRegistry();
  const reg2 = createAgentToolRegistry();

  assert.deepEqual(reg1.listIds(), reg2.listIds());

  const info = listAgentToolInfo();

  const ids = info.map((t) => t.id);
  assert.deepEqual(ids, [
    "echo",
    "json/extract",
    "json/merge",
    "json/select-keys",
    "math/add",
    "text/normalize"
  ]);

  for (const tool of info) {
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

  const jsonMerge = info.find((t) => t.id === "json/merge");
  assert.ok(jsonMerge);
  assert.equal(jsonMerge.pluginId, "builtin.json-merge");
  assert.equal(jsonMerge.pluginVersion, 1);
  assert.equal(jsonMerge.displayName, "JSON Merge");
  assert.deepEqual(jsonMerge.capabilities, ["json.merge"]);
  assert.deepEqual(jsonMerge.inputSchemaHint, {
    type: "object",
    required: ["left", "right"]
  });
});