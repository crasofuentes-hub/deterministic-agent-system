const test = require("node:test");
const assert = require("node:assert/strict");

const { executeDeterministicPlan } = require("../dist/src/agent/executor");

test("PLAN_VALIDATION_FAILED when plan has duplicate step id", () => {
  const plan = {
    planId: "bad-dup",
    version: 1,
    steps: [
      { id: "a", kind: "append_log", value: "x" },
      { id: "a", kind: "append_log", value: "y" }
    ]
  };

  const r = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-pv-1" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "PLAN_VALIDATION_FAILED");
});

test("PLAN_CANONICALIZATION_FAILED when canonicalization rejects oversized string values", () => {
  const big = "x".repeat(5000);

  const plan = {
    planId: "bad-canon-big",
    version: 1,
    steps: [
      { id: "a", kind: "append_log", value: big }
    ]
  };

  const r = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-pv-2" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "PLAN_CANONICALIZATION_FAILED");
});

test("PLAN_EXCEEDS_MAX_STEPS when plan length exceeds maxSteps", () => {
  const plan = {
    planId: "too-long",
    version: 1,
    steps: [
      { id: "a", kind: "append_log", value: "1" },
      { id: "b", kind: "append_log", value: "2" }
    ]
  };

  const r = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 1, traceId: "t-pv-3" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "PLAN_EXCEEDS_MAX_STEPS");
});