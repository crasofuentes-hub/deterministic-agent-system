const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveToolIdForCapability,
  listToolIdsForCapability,
} = require("../dist/src/agent/tools");

test("capability selector resolves deterministic tool ids", () => {
  assert.equal(resolveToolIdForCapability("text.normalize"), "text/normalize");
  assert.equal(resolveToolIdForCapability("json.extract"), "json/extract");
  assert.equal(resolveToolIdForCapability("json.merge"), "json/merge");
  assert.equal(resolveToolIdForCapability("math.add"), "math/add");
  assert.equal(resolveToolIdForCapability("echo"), "echo");
});

test("capability selector lists stable sorted matches", () => {
  assert.deepEqual(listToolIdsForCapability("json.extract"), ["json/extract"]);
  assert.deepEqual(listToolIdsForCapability("json.merge"), ["json/merge"]);
});