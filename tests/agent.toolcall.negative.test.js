const test = require("node:test");
const assert = require("node:assert/strict");

const { executeDeterministicPlan } = require("../dist/src/agent/executor");

test("tool.call fails deterministically when toolId is missing", () => {
  const plan = {
    planId: "neg-tool-missing",
    version: 1,
    steps: [
      { id: "a", kind: "tool.call", toolId: "nope/tool", input: { x: 1 }, outputKey: "out" }
    ]
  };

  const r1 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-neg-1" });
  const r2 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-neg-1" });

  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);

  // Determinismo: mismo error shape/mensaje
  assert.deepEqual(r1, r2);

  // Señal mínima estable
  assert.equal(r1.error.code, "INVALID_REQUEST");
  assert.ok(String(r1.error.message).includes("tool_not_found"));
});

test("tool.call fails deterministically when input is invalid", () => {
  const plan = {
    planId: "neg-tool-bad-input",
    version: 1,
    steps: [
      // math/add requiere {a:number,b:number}; aquí mandamos null
      { id: "a", kind: "tool.call", toolId: "math/add", input: null, outputKey: "out" }
    ]
  };

  const r1 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-neg-2" });
  const r2 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-neg-2" });

  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  assert.deepEqual(r1, r2);

  assert.equal(r1.error.code, "INVALID_REQUEST");
  assert.ok(String(r1.error.message).includes("tool_invalid_input"));
});