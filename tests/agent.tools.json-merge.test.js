const test = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry, toolJsonMerge } = require("../dist/src/agent/tools");

test("agent tool json/merge merges two objects deterministically", () => {
  const registry = new ToolRegistry([toolJsonMerge]);

  const out = registry.run(
    "json/merge",
    {},
    {
      left: JSON.stringify({ user: { name: "Oscar" }, source: "left" }),
      right: JSON.stringify({ meta: { ok: true }, source: "right" })
    }
  );

  assert.deepEqual(out, {
    value: {
      meta: { ok: true },
      source: "right",
      user: { name: "Oscar" }
    }
  });
});