import { startServer } from "../http/server";

type JsonRecord = Record<string, unknown>;

async function postJson(
  base: string,
  path: string,
  body: JsonRecord
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parseError: true, raw: text };
  }

  return { status: res.status, json, text };
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

    const r = await postJson(base, "/agent/run", body);

    if (r.status !== 200) {
      console.error("FAIL: non-200 response");
      console.error(JSON.stringify({ status: r.status, body: r.json }, null, 2));
      process.exitCode = 1;
      return;
    }

    if (!r.json?.ok) {
      console.error("FAIL: ok=false");
      console.error(JSON.stringify(r.json, null, 2));
      process.exitCode = 1;
      return;
    }

    const result = r.json.result;
    const summary = {
      ok: true,
      provider: body.llmProvider,
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
  console.error(err);
  process.exit(1);
});