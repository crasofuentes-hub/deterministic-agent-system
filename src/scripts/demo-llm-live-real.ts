import { startServer } from "../http/server";

type JsonRecord = Record<string, unknown>;

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function postJson(
  base: string,
  path: string,
  body: JsonRecord
): Promise<{ status: number; json: unknown; text: string }> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parseError: true, raw: text };
  }

  return { status: res.status, json, text };
}

function detectPathUsed(body: JsonRecord): "stub" | "real-provider" {
  return typeof body.llmPlanText === "string" ? "stub" : "real-provider";
}

async function main(): Promise<void> {
  const running = await startServer({ port: 0 });

  try {
    const base = "http://127.0.0.1:" + running.port;

    const body: JsonRecord = {
      goal: process.env.DAS_DEMO_GOAL ?? "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmModel: process.env.DAS_OPENAI_COMPAT_MODEL ?? "gpt-test",
      llmTemperature: 0,
      llmMaxTokens: 256,
      maxSteps: 12,
      traceId: "demo-llm-live-real-001",
    };

    const llmPlanText = String(process.env.DAS_LLM_PLAN_TEXT ?? "").trim();
    if (llmPlanText.length > 0) {
      body.llmPlanText = llmPlanText;
    }

    const pathUsed = detectPathUsed(body);
    const r = await postJson(base, "/agent/run", body);

    if (r.status !== 200) {
      const errObj = isObject(r.json) && isObject(r.json.error) ? r.json.error : {};
      const failure = {
        ok: false,
        pathUsed,
        goal: body.goal,
        provider: body.llmProvider,
        model: body.llmModel,
        usedStubPlanText: typeof body.llmPlanText === "string",
        status: r.status,
        errorCode: errObj.code ?? null,
        errorMessage: errObj.message ?? null,
      };

      console.error("FAIL: demo:agent:llm-live:real");
      console.error(JSON.stringify(failure, null, 2));
      process.exitCode = 1;
      return;
    }

    if (!isObject(r.json) || r.json.ok !== true || !isObject(r.json.result)) {
      const failure = {
        ok: false,
        pathUsed,
        goal: body.goal,
        provider: body.llmProvider,
        model: body.llmModel,
        usedStubPlanText: typeof body.llmPlanText === "string",
        status: r.status,
        body: r.json,
      };

      console.error("FAIL: unexpected response envelope");
      console.error(JSON.stringify(failure, null, 2));
      process.exitCode = 1;
      return;
    }

    const result = r.json.result;
    const summary = {
      ok: true,
      goal: body.goal,
      provider: body.llmProvider,
      model: body.llmModel,
      pathUsed,
      usedStubPlanText: typeof body.llmPlanText === "string",
      planId: result.planId,
      planHash: result.planHash,
      executionHash: result.executionHash,
      finalTraceLinkHash: result.finalTraceLinkHash,
      traceSchemaVersion: result.traceSchemaVersion,
      stepsRequested: result.stepsRequested,
      stepsExecuted: result.stepsExecuted,
      converged: result.converged,
      finalState: result.finalState,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await running.close();
  }
}

void main().catch((err) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error("FAIL: demo:agent:llm-live:real");
  console.error(message);
  process.exit(1);
});