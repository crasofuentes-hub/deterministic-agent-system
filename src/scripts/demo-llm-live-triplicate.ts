import { startServer } from "../http/server";

type Json = Record<string, unknown>;

async function postJson(base: string, path: string, body: Json): Promise<{ status: number; json: any }> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { parseError: true, raw: text }; }
  return { status: res.status, json };
}

function assertDet(a: any, b: any): void {
  if (!a?.ok || !b?.ok) throw new Error("expected ok=true");
  const ra = a.result, rb = b.result;
  const keys = ["planHash","executionHash","finalTraceLinkHash","traceSchemaVersion"] as const;
  for (const k of keys) if (ra[k] !== rb[k]) throw new Error("nondeterministic mismatch: " + k);
}

async function main(): Promise<void> {
  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;
    const body: Json = {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "mock",
      maxSteps: 12,
      traceId: "demo-llm-live-triplicate-001",
    };

    const r1 = await postJson(base, "/agent/run", body);
    const r2 = await postJson(base, "/agent/run", body);
    const r3 = await postJson(base, "/agent/run", body);

    if (r1.status !== 200 || r2.status !== 200 || r3.status !== 200) {
      throw new Error(`unexpected statuses: ${r1.status}, ${r2.status}, ${r3.status}`);
    }

    assertDet(r1.json, r2.json);
    assertDet(r2.json, r3.json);

    console.log(JSON.stringify({
      ok: true,
      planner: body.planner,
      hashes: {
        planHash: r1.json.result.planHash,
        executionHash: r1.json.result.executionHash,
        finalTraceLinkHash: r1.json.result.finalTraceLinkHash,
        traceSchemaVersion: r1.json.result.traceSchemaVersion,
      },
      values: r1.json.result.finalState?.values ?? {},
    }));
  } finally {
    await running.close();
  }
}

void main();