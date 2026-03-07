const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDeterministicPlanFromModelText,
} = require("../dist/src/agent-run/planner-llm-live");

test("llm-live parse: parses valid JSON plan text and canonicalizes steps", () => {
  const text = JSON.stringify({
    planId: "plan-from-model-v1",
    version: 1,
    steps: [
      { id: "b", kind: "increment", key: "count", value: 2 },
      { id: "a", kind: "set", key: "name", value: "oscar" }
    ]
  });

  const plan = parseDeterministicPlanFromModelText(text);

  assert.equal(plan.planId, "plan-from-model-v1");
  assert.equal(plan.version, 1);
  assert.equal(Array.isArray(plan.steps), true);
  assert.equal(plan.steps.length, 2);

  // Debe quedar canónico por id
  assert.equal(plan.steps[0].id, "a");
  assert.equal(plan.steps[1].id, "b");
});

test("llm-live parse: rejects non-object JSON", () => {
  assert.throws(
    () => parseDeterministicPlanFromModelText('"not-an-object"'),
    /llm_live_invalid_plan_text/
  );
});

test("llm-live parse: rejects malformed JSON", () => {
  assert.throws(
    () => parseDeterministicPlanFromModelText("{ bad json"),
    /llm_live_invalid_plan_text/
  );
});

test("llm-live parse: rejects structurally invalid plan", () => {
  const text = JSON.stringify({
    planId: "x",
    version: 1,
    steps: [
      { id: "a", kind: "set", value: "missing-key" }
    ]
  });

  assert.throws(
    () => parseDeterministicPlanFromModelText(text),
    /llm_live_invalid_plan_text/
  );
});