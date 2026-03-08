const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

function runDemo(extraEnv) {
  const env = { ...process.env, ...extraEnv };
  const result = spawnSync(process.execPath, ["dist/src/scripts/demo-llm-live-real.js"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseLastJson(text) {
  const s = String(text ?? "").trim();
  const starts = [];

  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "{") {
      starts.push(i);
    }
  }

  for (let i = starts.length - 1; i >= 0; i -= 1) {
    const candidate = s.slice(starts[i]).trim();
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // continue
    }
  }

  throw new Error("No parseable JSON object found in output");
}

test("demo llm-live real prints safeEvidence for deterministic stub path", () => {
  const stubPlan = JSON.stringify({
    planId: "demo-llm-live-stub-v1",
    version: 1,
    steps: [
      { id: "d", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
      { id: "b", kind: "set", key: "intent", value: "compute" },
      { id: "a", kind: "set", key: "goal", value: "sum 2 3" },
      { id: "c", kind: "append_log", value: "llm-live:planned" },
      { id: "e", kind: "append_log", value: "done" },
    ],
  });

  const r = runDemo({
    DAS_LLM_PLAN_TEXT: stubPlan,
    DAS_OPENAI_COMPAT_BASE_URL: "",
    DAS_OPENAI_COMPAT_API_KEY: "",
    DAS_OPENAI_COMPAT_MODEL: "",
  });

  assert.equal(r.status, 0, r.stderr || r.stdout);

  const json = parseLastJson(r.stdout);
  assert.equal(json.ok, true);
  assert.equal(json.pathUsed, "stub");
  assert.equal(json.usedStubPlanText, true);
  assert.equal(json.safeEvidence.materializationSource, "explicit-plan-text");
  assert.equal(json.safeEvidence.cacheEligible, true);
});

test("demo llm-live real prints safeEvidence for unconfigured real-provider path", () => {
  const r = runDemo({
    DAS_LLM_PLAN_TEXT: "",
    DAS_OPENAI_COMPAT_BASE_URL: "",
    DAS_OPENAI_COMPAT_API_KEY: "",
    DAS_OPENAI_COMPAT_MODEL: "",
  });

  assert.notEqual(r.status, 0);

  const json = parseLastJson(r.stderr);
  assert.equal(json.ok, false);
  assert.equal(json.pathUsed, "real-provider");
  assert.equal(json.usedStubPlanText, false);
  assert.equal(json.safeEvidence.materializationSource, "provider-materialization");
  assert.equal(json.safeEvidence.providerConfigPresent, false);
  assert.equal(json.safeEvidence.baseUrlConfigured, false);
  assert.equal(json.safeEvidence.apiKeyConfigured, false);
  assert.equal(json.errorCode, "INTERNAL_ERROR");
});