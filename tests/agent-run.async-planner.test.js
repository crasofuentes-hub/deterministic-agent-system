const test = require("node:test");
const assert = require("node:assert/strict");
const { runAgent } = require("../dist/src/agent-run/run");

test("runAgent uses planAsync when planner provides it", async () => {
  let syncCalled = false;
  let asyncCalled = false;

  const planner = {
    plan() {
      syncCalled = true;
      return {
        planId: "sync-should-not-run",
        version: 1,
        steps: [{ id: "a", kind: "set", key: "x", value: "bad" }]
      };
    },
    async planAsync(input) {
      asyncCalled = true;
      return {
        planId: "async-plan-v1",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: String(input.goal) },
          { id: "b", kind: "append_log", value: "done" }
        ]
      };
    }
  };

  const result = await runAgent(
    {
      goal: "hello",
      demo: "core",
      mode: "mock",
      maxSteps: 8,
      planner: "llm-live"
    },
    planner
  );

  assert.equal(result.ok, true);
  assert.equal(asyncCalled, true);
  assert.equal(syncCalled, false);

  if (result.ok) {
    assert.equal(result.result.planId, "async-plan-v1");
    assert.equal(result.result.finalState.values.goal, "hello");
  }
});

test("runAgent still uses sync plan when planAsync is absent", async () => {
  let syncCalled = false;

  const planner = {
    plan(input) {
      syncCalled = true;
      return {
        planId: "sync-plan-v1",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: String(input.goal) },
          { id: "b", kind: "append_log", value: "done" }
        ]
      };
    }
  };

  const result = await runAgent(
    {
      goal: "world",
      demo: "core",
      mode: "mock",
      maxSteps: 8,
      planner: "mock"
    },
    planner
  );

  assert.equal(result.ok, true);
  assert.equal(syncCalled, true);

  if (result.ok) {
    assert.equal(result.result.planId, "sync-plan-v1");
    assert.equal(result.result.finalState.values.goal, "world");
  }
});