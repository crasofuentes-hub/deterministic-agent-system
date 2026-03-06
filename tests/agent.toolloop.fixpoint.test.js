const test = require("node:test");
const assert = require("node:assert/strict");

const { executeDeterministicPlan } = require("../dist/src/agent/executor");

test("tool.loop converges by fixpoint deterministically", () => {
  const plan = {
    planId: "toolloop-fixpoint",
    version: 1,
    steps: [
      { id: "a", kind: "tool.loop", toolId: "math/add", input: { a: 1, b: 2 }, outputKey: "sum", maxIterations: 10 }
    ]
  };

  const r1 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-loop-1" });
  const r2 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t-loop-1" });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  // Determinismo: hashes idÃƒÂ©nticos en repeticiÃƒÂ³n
  assert.equal(r1.result.planHash, r2.result.planHash);
  assert.equal(r1.result.executionHash, r2.result.executionHash);
  assert.equal(r1.result.finalTraceLinkHash, r2.result.finalTraceLinkHash);

  // Resultado ÃƒÂºtil: sum debe existir
  assert.equal(r1.result.finalState.values.sum, "{\"sum\":3}");

  // Debe haber logs del loop con fix=1 en alguna iteraciÃƒÂ³n
  const logs = r1.result.finalState.logs.join("\n");
  assert.ok(logs.includes("tool.loop:i=0:tool=math/add:out=sum:fix=0"));
  assert.ok(logs.includes("fix=1"));
});