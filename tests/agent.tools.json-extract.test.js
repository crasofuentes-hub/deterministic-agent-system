const test = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry, toolJsonExtract } = require("../dist/src/agent/tools");

test("agent tool json/extract extracts nested property deterministically", () => {
  const registry = new ToolRegistry([toolJsonExtract]);

  const out = registry.run(
    "json/extract",
    {},
    {
      text: JSON.stringify({ user: { name: "Oscar", age: 33 }, items: [{ id: "a1" }] }),
      path: "user.name",
    }
  );

  assert.deepEqual(out, { value: "Oscar" });
});

test("agent tool json/extract extracts array element deterministically", () => {
  const registry = new ToolRegistry([toolJsonExtract]);

  const out = registry.run(
    "json/extract",
    {},
    {
      text: JSON.stringify({ items: [{ id: "a1" }, { id: "b2" }] }),
      path: "items.1.id",
    }
  );

  assert.deepEqual(out, { value: "b2" });
});

test("agent tool json/extract rejects invalid json", () => {
  const registry = new ToolRegistry([toolJsonExtract]);

  assert.throws(
    () => registry.run("json/extract", {}, { text: "{ bad json", path: "x" }),
    /json_extract_invalid_json/
  );
});