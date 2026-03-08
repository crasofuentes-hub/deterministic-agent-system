const test = require("node:test");
const assert = require("node:assert/strict");
const { LlmLivePlanner } = require("../dist/src/agent-run/planner-llm-live");
const fs = require("node:fs");

test("llm-live planAsync uses injected openai-compatible adapter when llmPlanText is absent", async () => {
  try { fs.rmSync(".llm-live-cache", { recursive: true, force: true }); } catch {}

  let calls = 0;

  const adapter = {
    adapterId: "openai-compatible:gpt-test",
    async generateAsync(request) {
      calls += 1;
      assert.equal(typeof request.prompt, "string");
      assert.equal(request.maxTokens, 256);
      assert.equal(request.temperature, 0);

      return {
        text: JSON.stringify({
          planId: "provider-real-path-v1",
          version: 1,
          steps: [
            { id: "d", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
            { id: "b", kind: "set", key: "intent", value: "compute" },
            { id: "a", kind: "set", key: "goal", value: "sum 2 3" },
            { id: "c", kind: "append_log", value: "llm-live:planned" },
            { id: "e", kind: "append_log", value: "done" }
          ]
        }),
        modelId: "gpt-test",
        tokenCount: 10,
        deterministic: false,
        evidence: {
          providerKind: "openai-compatible",
          endpoint: "https://example.test/v1/chat/completions",
          model: "gpt-test",
          requestFingerprint: "rq_test",
          responseFingerprint: "rs_test",
          httpStatus: 200,
          providerDeterminism: "unknown"
        }
      };
    }
  };

  const planner = new LlmLivePlanner(adapter);

  const input = {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    maxSteps: 12,
    planner: "llm-live",
    llmProvider: "openai-compatible",
    llmModel: "gpt-test",
    llmTemperature: 0,
    llmMaxTokens: 256
  };

  const p1 = await planner.planAsync(input);
  const p2 = await planner.planAsync(input);

  assert.equal(calls, 1);
  assert.equal(p1.planId, "provider-real-path-v1");
  assert.deepEqual(p1, p2);
  assert.equal(p1.steps[0].id, "a");
  assert.equal(p1.steps[4].id, "e");
});

test("llm-live planAsync returns stable config error when real adapter is not configured", async () => {
  const planner = new LlmLivePlanner();

  await assert.rejects(
    () => planner.planAsync({
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      maxSteps: 12,
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmModel: "gpt-test"
    }),
    /llm_live_not_configured/
  );
});