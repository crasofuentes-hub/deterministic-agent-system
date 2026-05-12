const assert = require("node:assert/strict");
const test = require("node:test");
const { startServer } = require("../dist/src/http/server");

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = {
      parseError: true,
      raw: text,
    };
  }

  return {
    status: response.status,
    body,
  };
}

test("http POST /agent/run planner=llm-live supports verified planner prompt output mode", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const llmPlanText = JSON.stringify({
      decisionSummary: "The request asks to add two known integers, so one math/add tool call is sufficient.",
      requiresClarification: false,
      clarificationQuestion: null,
      assumptions: [],
      missingInputs: [],
      steps: [
        {
          step: 1,
          tool: "math/add",
          parameters: {
            a: 2,
            b: 3
          },
          explanation: "Compute the deterministic sum for the provided integers."
        }
      ]
    });

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmPlanTextFormat: "planner-prompt-output",
      llmVerifiedPlanId: "agent-run-llm-live-verified-planner-http-v1",
      llmPlannerAvailableTools: [
        {
          name: "math/add",
          description: "Add two numbers deterministically.",
          parametersSchema: {
            type: "object",
            required: ["a", "b"],
            additionalProperties: false,
            properties: {
              a: {
                type: "number"
              },
              b: {
                type: "number"
              }
            }
          }
        }
      ],
      llmPlanText,
      maxSteps: 12,
      traceId: "trace-llm-live-verified-planner-http-001"
    };

    const response = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.result.planId, "agent-run-llm-live-verified-planner-http-v1");
    assert.equal(response.body.result.finalState.values.llm_step_1, "{\"sum\":5}");
    assert.equal(typeof response.body.result.planHash, "string");
    assert.equal(typeof response.body.result.executionHash, "string");
    assert.equal(typeof response.body.result.finalTraceLinkHash, "string");
  } finally {
    await running.close();
  }
});

test("http POST /agent/run planner=llm-live rejects invalid verified planner prompt output mode deterministically", async () => {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const llmPlanText = JSON.stringify({
      decisionSummary: "Use an invented tool.",
      requiresClarification: false,
      clarificationQuestion: null,
      assumptions: [],
      missingInputs: [],
      steps: [
        {
          step: 1,
          tool: "invented.tool",
          parameters: {},
          explanation: "This must be rejected before execution."
        }
      ]
    });

    const body = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmPlanTextFormat: "planner-prompt-output",
      llmPlannerAvailableTools: [
        {
          name: "math/add",
          description: "Add two numbers deterministically.",
          parametersSchema: {
            type: "object",
            required: ["a", "b"],
            additionalProperties: false,
            properties: {
              a: {
                type: "number"
              },
              b: {
                type: "number"
              }
            }
          }
        }
      ],
      llmPlanText,
      maxSteps: 12,
      traceId: "trace-llm-live-verified-planner-http-invalid-001"
    };

    const response = await requestJson(base + "/agent/run", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error.code, "LLM_LIVE_INVALID_PLAN_TEXT");
    assert.equal(response.body.error.retryable, false);
    assert.match(response.body.error.message, /LLM_LIVE_PLANNER_CONTRACT_INVALID/);
  } finally {
    await running.close();
  }
});