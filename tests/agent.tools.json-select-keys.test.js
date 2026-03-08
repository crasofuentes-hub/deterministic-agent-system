const test = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry, toolJsonSelectKeys } = require("../dist/src/agent/tools");

test("agent tool json/select-keys selects keys deterministically", () => {
  const registry = new ToolRegistry([toolJsonSelectKeys]);

  const out = registry.run(
    "json/select-keys",
    {},
    {
      text: JSON.stringify({ user: { name: "Oscar" }, meta: { ok: true }, x: 1 }),
      keys: ["meta", "user"]
    }
  );

  assert.deepEqual(out, {
    value: {
      meta: { ok: true },
      user: { name: "Oscar" }
    }
  });
});