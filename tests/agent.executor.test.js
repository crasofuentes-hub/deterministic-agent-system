const assert = require("node:assert/strict");
const {
  executeDeterministicPlan,
  computeDeterministicPlanHash,
  canonicalizePlan,
  toCanonicalPlanJson,
} = require("../dist/src/agent");

function testValidPlanExecutes() {
  const plan = {
    planId: "p1",
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "name", value: "oscar" },
      { id: "b", kind: "increment", key: "count", value: 2 },
      { id: "c", kind: "append_log", value: "done" },
    ],
  };

  const res = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t1" });
  assert.equal(res.ok, true);

  if (res.ok) {
    assert.equal(res.result.planHash.startsWith("ph"), true);
    assert.equal(res.result.executionHash.startsWith("eh"), true);
    assert.equal(res.result.finalTraceLinkHash.startsWith("tl"), true);
    assert.equal(res.result.trace.length, 3);
    assert.equal(res.result.trace[0].traceLinkHash.startsWith("tl"), true);
    assert.equal(typeof res.result.trace[0].previousTraceLinkHash, "string");
  }
}

function testDeterministicExecutionHashStable() {
  const plan = {
    planId: "p2",
    version: 1,
    steps: [
      { id: "b", kind: "increment", key: "n", value: 2 },
      { id: "a", kind: "set", key: "mode", value: "x" },
    ],
  };

  const r1 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "x1" });
  const r2 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "x2" });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  if (r1.ok && r2.ok) {
    assert.equal(r1.result.planHash, r2.result.planHash);
    assert.equal(r1.result.executionHash, r2.result.executionHash);
    assert.equal(r1.result.finalTraceLinkHash, r2.result.finalTraceLinkHash);
  }
}

function testCanonicalEquivalentPlansHaveSameHash() {
  const planA = {
    planId: "peq",
    version: 1,
    steps: [
      { id: "b", kind: "increment", key: "count", value: 2 },
      { id: "a", kind: "set", key: "name", value: "oscar" },
    ],
  };

  const planB = {
    planId: "peq",
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "name", value: "oscar" },
      { id: "b", kind: "increment", key: "count", value: 2 },
    ],
  };

  const canonA = canonicalizePlan(planA);
  const canonB = canonicalizePlan(planB);
  assert.equal(toCanonicalPlanJson(canonA), toCanonicalPlanJson(canonB));

  const hashA = computeDeterministicPlanHash(planA);
  const hashB = computeDeterministicPlanHash(planB);
  assert.equal(hashA, hashB);

  const resA = executeDeterministicPlan(planA, { mode: "mock", maxSteps: 10 });
  const resB = executeDeterministicPlan(planB, { mode: "mock", maxSteps: 10 });
  assert.equal(resA.ok, true);
  assert.equal(resB.ok, true);

  if (resA.ok && resB.ok) {
    assert.equal(resA.result.executionHash, resB.result.executionHash);
    assert.deepEqual(resA.result.finalState, resB.result.finalState);
  }
}

function main() {
  testValidPlanExecutes();
  testDeterministicExecutionHashStable();
  testCanonicalEquivalentPlansHaveSameHash();
  console.log("agent.executor.test PASS");
}

main();
