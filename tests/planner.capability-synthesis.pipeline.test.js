const test = require("node:test");
const assert = require("node:assert/strict");

const { LlmLivePlanner } = require("../dist/src/agent-run/planner-llm-live");
const { LlmMockPlanner } = require("../dist/src/agent-run/planner-llm-mock");

test("llm-live planner synthesizes normalize -> extract -> merge pipeline from goal", () => {
  const planner = new LlmLivePlanner();
  const plan = planner.plan({
    goal: "normalize extract merge user data",
    demo: "core",
    mode: "mock",
    planner: "llm-live",
    llmProvider: "mock",
    maxSteps: 12,
    traceId: "planner-cap-synth-live-001"
  });

  assert.equal(plan.planId, "agent-run-llm-live-mock-v1:cap-synth");
  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["text/normalize", "json/extract", "json/merge"]);
});

test("llm-mock planner synthesizes normalize -> extract -> merge pipeline from goal", () => {
  const planner = new LlmMockPlanner();
  const plan = planner.plan({
    goal: "normalize extract merge user data",
    demo: "core",
    mode: "mock",
    planner: "llm-mock",
    maxSteps: 12,
    traceId: "planner-cap-synth-mock-001"
  });

  assert.equal(plan.planId, "agent-run-llm-mock-v1:cap-synth");
  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["text/normalize", "json/extract", "json/merge"]);
});

test("llm-live planner upgrades select-only goal into extract -> select", () => {
  const planner = new LlmLivePlanner();
  const plan = planner.plan({
    goal: "select user keys",
    demo: "core",
    mode: "mock",
    planner: "llm-live",
    llmProvider: "mock",
    maxSteps: 12,
    traceId: "planner-cap-synth-live-002"
  });

  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["json/extract", "json/select-keys"]);
});

test("llm-mock planner upgrades merge-only goal into extract -> merge", () => {
  const planner = new LlmMockPlanner();
  const plan = planner.plan({
    goal: "merge user data",
    demo: "core",
    mode: "mock",
    planner: "llm-mock",
    maxSteps: 12,
    traceId: "planner-cap-synth-mock-002"
  });

  const toolIds = plan.steps.filter((s) => s.kind === "tool.call").map((s) => s.toolId);
  assert.deepEqual(toolIds, ["json/extract", "json/merge"]);
});