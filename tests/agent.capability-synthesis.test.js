const test = require("node:test");
const assert = require("node:assert/strict");

const {
  synthesizeCapabilitiesFromGoal,
} = require("../dist/src/agent-run/capability-synthesis");

test("capability synthesis derives normalize -> extract -> merge", () => {
  const caps = synthesizeCapabilitiesFromGoal("normalize extract merge user data");
  assert.deepEqual(caps, ["text.normalize", "json.extract", "json.merge"]);
});

test("capability synthesis falls back to math.add when goal is compute-only", () => {
  const caps = synthesizeCapabilitiesFromGoal("sum 2 3");
  assert.deepEqual(caps, ["math.add"]);
});

test("capability synthesis falls back to echo for generic goal", () => {
  const caps = synthesizeCapabilitiesFromGoal("just say hello");
  assert.deepEqual(caps, ["echo"]);
});