const test = require("node:test");
const assert = require("node:assert/strict");
const { LlmLivePlanner } = require("../dist/src/agent-run/planner-llm-live");
const fs = require("node:fs");

test("llm-live planAsync uses stub llmPlanText deterministically", async () => {
  try { fs.rmSync(".llm-live-cache", { recursive: true, force: true }); } catch {}

  const planner = new LlmLivePlanner();

  const input = {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    maxSteps: 12,
    planner: "llm-live",
    llmProvider: "openai-compatible",
    llmModel: "gpt-test",
    llmTemperature: 0,
    llmMaxTokens: 256,
    llmPlanText: JSON.stringify({
      planId: "agent-run-llm-live-openai-stub-v1",
      version: 1,
      steps: [
        { id: "d", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
        { id: "b", kind: "set", key: "intent", value: "compute" },
        { id: "a", kind: "set", key: "goal", value: "sum 2 3" },
        { id: "c", kind: "append_log", value: "llm-live:planned" },
        { id: "e", kind: "append_log", value: "done" }
      ]
    })
  };

  const p1 = await planner.planAsync(input);
  const p2 = await planner.planAsync(input);

  assert.equal(p1.planId, "agent-run-llm-live-openai-stub-v1");
  assert.equal(p2.planId, "agent-run-llm-live-openai-stub-v1");
  assert.equal(p1.steps.length, 5);
  assert.equal(p2.steps.length, 5);

  assert.equal(p1.steps[0].id, "a");
  assert.equal(p1.steps[1].id, "b");
  assert.equal(p1.steps[2].id, "c");
  assert.equal(p1.steps[3].id, "d");
  assert.equal(p1.steps[4].id, "e");

  assert.deepEqual(p1, p2);
});

test("llm-live sync plan rejects openai-compatible real path with stable error", () => {
  const planner = new LlmLivePlanner();

  assert.throws(
    () => planner.plan({
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      maxSteps: 12,
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmModel: "gpt-test"
    }),
    /llm_live_requires_async_planner/
  );
});