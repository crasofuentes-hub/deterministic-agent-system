const assert = require("assert");
const { InMemoryAgentRunRegistry } = require("../dist/src/agent-run");

function testLifecycleSuccess() {
  const r = new InMemoryAgentRunRegistry();

  const created = r.create({
    runId: "run-001",
    agentId: "agent-main",
    requestId: "req-001",
    createdAt: "2026-02-24T13:00:00.000Z",
    traceSchemaVersion: 1,
    metadata: { env: "test" }
  });

  assert.strictEqual(created.status, "created");
  assert.strictEqual(created.determinism.traceSchemaVersion, 1);

  const running = r.start({
    runId: "run-001",
    startedAt: "2026-02-24T13:00:01.000Z"
  });

  assert.strictEqual(running.status, "running");
  assert.strictEqual(running.timestamps.startedAt, "2026-02-24T13:00:01.000Z");

  const succeeded = r.succeed({
    runId: "run-001",
    finishedAt: "2026-02-24T13:00:02.000Z",
    planHash: "ph-abc",
    executionHash: "eh-abc",
    finalTraceLinkHash: "tl-abc"
  });

  assert.strictEqual(succeeded.status, "succeeded");
  assert.strictEqual(succeeded.determinism.planHash, "ph-abc");
  assert.strictEqual(succeeded.error, undefined);

  const found = r.get("run-001");
  assert.ok(found);
  assert.strictEqual(found.status, "succeeded");
}

function testLifecycleFailure() {
  const r = new InMemoryAgentRunRegistry();

  r.create({
    runId: "run-err-001",
    agentId: "agent-main",
    createdAt: "2026-02-24T13:10:00.000Z",
    traceSchemaVersion: 1
  });

  r.start({
    runId: "run-err-001",
    startedAt: "2026-02-24T13:10:01.000Z"
  });

  const failed = r.fail({
    runId: "run-err-001",
    finishedAt: "2026-02-24T13:10:02.000Z",
    error: { code: "AGENT_EXECUTION_FAILED", message: "bounded loop did not converge" },
    planHash: "ph-err",
    executionHash: "eh-err"
  });

  assert.strictEqual(failed.status, "failed");
  assert.strictEqual(failed.error.code, "AGENT_EXECUTION_FAILED");
  assert.strictEqual(failed.determinism.planHash, "ph-err");
}

function testStableListOrdering() {
  const r = new InMemoryAgentRunRegistry();

  r.create({
    runId: "run-b",
    agentId: "agent-main",
    createdAt: "2026-02-24T13:20:00.000Z",
    traceSchemaVersion: 1
  });

  r.create({
    runId: "run-a",
    agentId: "agent-main",
    createdAt: "2026-02-24T13:20:00.000Z",
    traceSchemaVersion: 1
  });

  r.create({
    runId: "run-c",
    agentId: "agent-main",
    createdAt: "2026-02-24T13:21:00.000Z",
    traceSchemaVersion: 1
  });

  const list = r.list();
  assert.deepStrictEqual(
    list.map((x) => x.runId),
    ["run-a", "run-b", "run-c"]
  );
}

function testInvalidTransitions() {
  const r = new InMemoryAgentRunRegistry();

  r.create({
    runId: "run-002",
    agentId: "agent-main",
    createdAt: "2026-02-24T13:30:00.000Z",
    traceSchemaVersion: 1
  });

  assert.throws(() => {
    r.succeed({
      runId: "run-002",
      finishedAt: "2026-02-24T13:30:02.000Z",
      planHash: "ph",
      executionHash: "eh",
      finalTraceLinkHash: "tl"
    });
  }, /Invalid transition/);

  r.start({
    runId: "run-002",
    startedAt: "2026-02-24T13:30:01.000Z"
  });

  r.succeed({
    runId: "run-002",
    finishedAt: "2026-02-24T13:30:02.000Z",
    planHash: "ph",
    executionHash: "eh",
    finalTraceLinkHash: "tl"
  });

  assert.throws(() => {
    r.fail({
      runId: "run-002",
      finishedAt: "2026-02-24T13:30:03.000Z",
      error: { code: "LATE_FAIL", message: "should not happen" }
    });
  }, /Invalid transition/);
}

function main() {
  testLifecycleSuccess();
  testLifecycleFailure();
  testStableListOrdering();
  testInvalidTransitions();
  console.log("agent-run.registry.test PASS");
}

main();