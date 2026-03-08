const test = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry, toolTextNormalize } = require("../dist/src/agent/tools");

test("agent tool text/normalize normalizes deterministically", () => {
  const registry = new ToolRegistry([toolTextNormalize]);

  const out = registry.run(
    "text/normalize",
    {},
    {
      text: "  HéLLo    WORLD  ",
      trim: true,
      lowercase: true,
      collapseWhitespace: true,
    }
  );

  assert.deepEqual(out, { text: "héllo world" });
});

test("agent tool text/normalize rejects invalid input", () => {
  const registry = new ToolRegistry([toolTextNormalize]);

  assert.throws(
    () => registry.run("text/normalize", {}, { text: 123 }),
    /tool_invalid_input: text\/normalize/
  );
});