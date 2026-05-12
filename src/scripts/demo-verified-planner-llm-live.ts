import { startServer } from "../http/server";

interface DemoHttpResult {
  readonly status: number;
  readonly body: unknown;
}

async function postJson(url: string, body: unknown): Promise<DemoHttpResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text.length > 0 ? JSON.parse(text) : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(name + " must be an object");
  }

  return value;
}

async function main(): Promise<void> {
  const running = await startServer({ port: 0 });

  try {
    const baseUrl = "http://127.0.0.1:" + String(running.port);

    const llmPlanText = JSON.stringify({
      decisionSummary:
        "The request asks to add two known integers, so one deterministic math/add tool call is sufficient.",
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
            b: 3,
          },
          explanation: "Compute the deterministic sum for the provided integers.",
        },
      ],
    });

    const requestBody = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmPlanTextFormat: "planner-prompt-output",
      llmVerifiedPlanId: "demo-verified-planner-llm-live-v1",
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
                type: "number",
              },
              b: {
                type: "number",
              },
            },
          },
        },
      ],
      llmPlanText,
      maxSteps: 12,
      traceId: "demo-verified-planner-llm-live-001",
    };

    const response = await postJson(baseUrl + "/agent/run", requestBody);

    if (response.status !== 200) {
      throw new Error("Unexpected HTTP status: " + String(response.status));
    }

    const body = requireRecord(response.body, "response.body");

    if (body.ok !== true) {
      throw new Error("Demo request failed: " + JSON.stringify(body));
    }

    const result = requireRecord(body.result, "response.body.result");
    const finalState = requireRecord(result.finalState, "response.body.result.finalState");
    const values = requireRecord(finalState.values, "response.body.result.finalState.values");

    const summary = {
      demo: "verified-planner-llm-live",
      request: {
        planner: requestBody.planner,
        llmPlanTextFormat: requestBody.llmPlanTextFormat,
        llmVerifiedPlanId: requestBody.llmVerifiedPlanId,
        declaredTools: requestBody.llmPlannerAvailableTools.map((tool) => tool.name),
      },
      result: {
        planId: result.planId,
        planHash: result.planHash,
        executionHash: result.executionHash,
        finalTraceLinkHash: result.finalTraceLinkHash,
        finalStateValues: values,
      },
    };

    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } finally {
    await running.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(message + "\n");
  process.exitCode = 1;
});