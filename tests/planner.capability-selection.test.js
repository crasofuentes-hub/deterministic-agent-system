const test = require("node:test");
const assert = require("node:assert/strict");

const { LlmLivePlanner } = require("../dist/src/agent-run/planner-llm-live");
const { LlmMockPlanner } = require("../dist/src/agent-run/planner-llm-mock");

test("llm-live planner uses capability-resolved tool ids for extract-merge", () => {
  const planner = new LlmLivePlanner();
  const plan = planner.plan({
    goal: "extract and merge user data",
    demo: "core",
    mode: "mock",
    planner: "llm-live",
    llmProvider: "mock",
    maxSteps: 12,
    traceId: "planner-cap-live-001"
  });

  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["text/normalize", "json/extract", "json/merge"]);
});

test("llm-mock planner uses capability-resolved tool ids for extract-merge", () => {
  const planner = new LlmMockPlanner();
  const plan = planner.plan({
    goal: "extract and merge user data",
    demo: "core",
    mode: "mock",
    planner: "llm-mock",
    maxSteps: 12,
    traceId: "planner-cap-mock-001"
  });

  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["text/normalize", "json/extract", "json/merge"]);
});