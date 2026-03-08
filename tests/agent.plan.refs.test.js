const test = require("node:test");
const assert = require("node:assert/strict");

const { canonicalizePlan } = require("../dist/src/agent/canonical-plan");
const { validatePlan } = require("../dist/src/agent/policies");

test("plan validation accepts formal $ref input", () => {
  const plan = {
    planId: "plan-ref-v1",
    version: 1,
    steps: [
      {
        id: "a",
        kind: "tool.call",
        toolId: "json/extract",
        input: {
          text: { "$ref": "state.values.normalizedJson.text" },
          path: "user.name"
        },
        outputKey: "extracted"
      }
    ]
  };

  const out = validatePlan(plan);
  assert.equal(out.ok, true);
});

test("canonicalizePlan preserves formal $ref object deterministically", () => {
  const plan = {
    planId: "plan-ref-v1",
    version: 1,
    steps: [
      {
        id: "a",
        kind: "tool.call",
        toolId: "json/extract",
        input: {
          path: "user.name",
          text: { "$ref": "state.values.normalizedJson.text" }
        },
        outputKey: "extracted"
      }
    ]
  };

  const canon = canonicalizePlan(plan);
  assert.equal(canon.steps[0].input.text["$ref"], "state.values.normalizedJson.text");
});