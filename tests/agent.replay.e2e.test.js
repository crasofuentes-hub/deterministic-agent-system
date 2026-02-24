const assert = require("node:assert/strict");
const {
  executeDeterministicPlan,
  verifyExecutionReplay,
  canonicalizePlan,
  TRACE_SCHEMA_VERSION,
} = require("../dist/src/agent");

function testExactSameInputProducesExactSameOutput() {
  const plan = {
    planId: "replay-plan-001",
    version: 1,
    steps: [
      { id: "b", kind: "increment", key: "n", value: 2 },
      { id: "a", kind: "set", key: "mode", value: "demo" },
      { id: "c", kind: "append_log", value: "done" },
    ],
  };

  const r1 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t1" });
  const r2 = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10, traceId: "t2" });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  if (r1.ok && r2.ok) {
    assert.equal(r1.result.traceSchemaVersion, TRACE_SCHEMA_VERSION);
    assert.equal(r2.result.traceSchemaVersion, TRACE_SCHEMA_VERSION);

    assert.equal(r1.result.planHash, r2.result.planHash);
    assert.equal(r1.result.executionHash, r2.result.executionHash);
    assert.equal(r1.result.finalTraceLinkHash, r2.result.finalTraceLinkHash);

    assert.deepEqual(r1.result.finalState, r2.result.finalState);
    assert.deepEqual(r1.result.trace, r2.result.trace);
  }
}

function testReplayVerificationEndToEnd() {
  const plan = {
    planId: "replay-plan-002",
    version: 1,
    steps: [
      { id: "s2", kind: "increment", key: "iterations", value: 1 },
      { id: "s1", kind: "set", key: "mode", value: "bootstrap" },
    ],
  };

  const first = executeDeterministicPlan(plan, { mode: "mock", maxSteps: 10 });
  assert.equal(first.ok, true);

  if (first.ok) {
    const replay = verifyExecutionReplay({ plan, recorded: first.result });
    assert.equal(replay.ok, true);
  }
}

function testCanonicalizationRejectsExtraFields() {
  const bad = {
    planId: "bad-plan",
    version: 1,
    steps: [{ id: "a", kind: "set", key: "mode", value: "x", extraField: "not-allowed" }],
  };

  assert.throws(() => canonicalizePlan(bad), /unsupported fields/i);
}

function testCanonicalizationRejectsInvalidNumbers() {
  const bad = {
    planId: "bad-plan",
    version: 1,
    steps: [{ id: "a", kind: "increment", key: "n", value: 1.25 }],
  };

  assert.throws(() => canonicalizePlan(bad), /finite integer/i);
}

function testUnicodeNormalizationStability() {
  const composed = "café";
  const decomposed = "cafe\u0301";

  const p1 = {
    planId: "unicode-plan",
    version: 1,
    steps: [{ id: "a", kind: "set", key: "text", value: composed }],
  };

  const p2 = {
    planId: "unicode-plan",
    version: 1,
    steps: [{ id: "a", kind: "set", key: "text", value: decomposed }],
  };

  const r1 = executeDeterministicPlan(p1, { mode: "mock", maxSteps: 10 });
  const r2 = executeDeterministicPlan(p2, { mode: "mock", maxSteps: 10 });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  if (r1.ok && r2.ok) {
    assert.equal(r1.result.planHash, r2.result.planHash);
    assert.equal(r1.result.executionHash, r2.result.executionHash);
  }
}

function main() {
  testExactSameInputProducesExactSameOutput();
  testReplayVerificationEndToEnd();
  testCanonicalizationRejectsExtraFields();
  testCanonicalizationRejectsInvalidNumbers();
  testUnicodeNormalizationStability();
  console.log("agent.replay.e2e.test PASS");
}

main();
