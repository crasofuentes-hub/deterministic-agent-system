const assert = require("node:assert/strict");
const { runBoundedLoop } = require("../dist/core");

function testConverges() {
  const res = runBoundedLoop({
    mode: "mock",
    maxSteps: 10,
    initialState: 0,
    step: (s) => s + 1,
    isConverged: (s) => s >= 4,
    traceId: "t1",
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.result.converged, true);
    assert.equal(res.result.finalState, 4);
    assert.equal(res.meta.mode, "mock");
  }
}

function testInvalidMaxSteps() {
  const res = runBoundedLoop({
    mode: "local",
    maxSteps: 0,
    initialState: 0,
    step: (s) => s + 1,
    isConverged: () => false,
  });

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, "INVALID_REQUEST");
  }
}

function testNonConvergence() {
  const res = runBoundedLoop({
    mode: "local",
    maxSteps: 3,
    initialState: 0,
    step: (s) => s + 1,
    isConverged: () => false,
    traceId: "t2",
  });

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, "EXECUTION_CONVERGENCE_FAILED");
    assert.equal(res.meta.stepCount, 3);
  }
}

function main() {
  testConverges();
  testInvalidMaxSteps();
  testNonConvergence();
  console.log("core.bounded-loop.test PASS");
}

main();