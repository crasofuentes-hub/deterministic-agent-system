import { startServer } from "../src/http/server";
import { readJson, assertFileExists, resolveRepoPath, runStep, writeUtf8NoBom, fileSize } from "./lib/io";
import { joinLines, sanitizeInline, utcStamp } from "./lib/markdown";

type UnknownRecord = Record<string, unknown>;

type ShapeResult = {
  source: string;
  ok: boolean;
  errors: string[];
};

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateErrorResponseShape(obj: unknown, source: string): ShapeResult {
  const errors: string[] = [];

  if (!isObject(obj)) {
    return { source, ok: false, errors: ["Top-level JSON must be an object"] };
  }

  if (!Object.prototype.hasOwnProperty.call(obj, "ok")) {
    errors.push("Missing top-level property: ok");
  }
  if (!Object.prototype.hasOwnProperty.call(obj, "error")) {
    errors.push("Missing top-level property: error");
  }

  if (Object.prototype.hasOwnProperty.call(obj, "ok") && obj.ok !== false) {
    errors.push("Property 'ok' must be false");
  }

  const err = obj.error;
  if (typeof err === "undefined" || err === null) {
    errors.push("Property 'error' must not be null/undefined");
  } else if (!isObject(err)) {
    errors.push("Property 'error' must be an object");
  } else {
    if (!Object.prototype.hasOwnProperty.call(err, "code")) {
      errors.push("Missing error.code");
    }
    if (!Object.prototype.hasOwnProperty.call(err, "message")) {
      errors.push("Missing error.message");
    }
    if (!Object.prototype.hasOwnProperty.call(err, "retryable")) {
      errors.push("Missing error.retryable");
    }

    if (Object.prototype.hasOwnProperty.call(err, "code")) {
      const code = err.code;
      if (typeof code !== "string" || code.trim().length === 0) {
        errors.push("error.code must be a non-empty string");
      } else if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
        errors.push("error.code must match ^[A-Z][A-Z0-9_]*$");
      }
    }

    if (Object.prototype.hasOwnProperty.call(err, "message")) {
      const msg = err.message;
      if (typeof msg !== "string" || msg.trim().length === 0) {
        errors.push("error.message must be a non-empty string");
      } else if (msg.length > 1000) {
        errors.push("error.message exceeds 1000 characters");
      }
    }

    if (Object.prototype.hasOwnProperty.call(err, "retryable")) {
      if (typeof err.retryable !== "boolean") {
        errors.push("error.retryable must be boolean");
      }
    }
  }

  return { source, ok: errors.length === 0, errors };
}

function validateAgentRunSuccessShape(obj: unknown, source: string): ShapeResult {
  const errors: string[] = [];

  if (!isObject(obj)) {
    return { source, ok: false, errors: ["Top-level JSON must be an object"] };
  }

  if (obj.ok !== true) {
    errors.push("Property 'ok' must be true");
  }

  if (!Object.prototype.hasOwnProperty.call(obj, "result")) {
    errors.push("Missing top-level property: result");
    return { source, ok: errors.length === 0, errors };
  }

  const result = obj.result;
  if (!isObject(result)) {
    errors.push("Property 'result' must be an object");
    return { source, ok: errors.length === 0, errors };
  }

  const requiredStringProps = [
    "planId",
    "planHash",
    "executionHash",
    "finalTraceLinkHash",
  ];

  for (const k of requiredStringProps) {
    if (typeof result[k] !== "string" || String(result[k]).trim().length === 0) {
      errors.push("result." + k + " must be a non-empty string");
    }
  }

  if (typeof result.traceSchemaVersion !== "number" || !Number.isInteger(result.traceSchemaVersion)) {
    errors.push("result.traceSchemaVersion must be an integer");
  }

  if (typeof result.stepsRequested !== "number" || !Number.isInteger(result.stepsRequested)) {
    errors.push("result.stepsRequested must be an integer");
  }

  if (typeof result.stepsExecuted !== "number" || !Number.isInteger(result.stepsExecuted)) {
    errors.push("result.stepsExecuted must be an integer");
  }

  if (typeof result.converged !== "boolean") {
    errors.push("result.converged must be boolean");
  }

  if (!isObject(result.finalState)) {
    errors.push("result.finalState must be an object");
  } else {
    const finalState = result.finalState;
    if (!isObject(finalState.counters)) errors.push("result.finalState.counters must be an object");
    if (!isObject(finalState.values)) errors.push("result.finalState.values must be an object");
    if (!Array.isArray(finalState.logs)) errors.push("result.finalState.logs must be an array");
  }

  if (!Array.isArray(result.trace)) {
    errors.push("result.trace must be an array");
  }

  return { source, ok: errors.length === 0, errors };
}

async function postJson(
  base: string,
  path: string,
  body: unknown
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

async function main(): Promise<void> {
  const required = [
    resolveRepoPath("docs", "error-codes.md"),
    resolveRepoPath("schemas", "error-response.schema.json"),
    resolveRepoPath("samples", "error-response.valid.json"),
    resolveRepoPath("samples", "error-response.invalid.missing-code.json"),
  ];

  const checks = [
    ...required.map((f) =>
      runStep("Required file exists: " + f.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", ""), () => {
        assertFileExists(f);
      })
    ),
  ];

  const validPath = resolveRepoPath("samples", "error-response.valid.json");
  const invalidPath = resolveRepoPath("samples", "error-response.invalid.missing-code.json");

  let validObj: unknown;
  let invalidObj: unknown;

  checks.push(
    runStep("Read valid sample JSON", () => {
      validObj = readJson<unknown>(validPath);
    })
  );

  checks.push(
    runStep("Read invalid sample JSON", () => {
      invalidObj = readJson<unknown>(invalidPath);
    })
  );

  let validShape: ShapeResult = { source: "valid", ok: false, errors: ["Not executed"] };
  let invalidShape: ShapeResult = { source: "invalid", ok: false, errors: ["Not executed"] };

  checks.push(
    runStep("Valid sample passes shape validation", () => {
      validShape = validateErrorResponseShape(validObj, "samples/error-response.valid.json");
      if (!validShape.ok) {
        throw new Error(validShape.errors.join(" | "));
      }
    })
  );

  checks.push(
    runStep("Invalid sample fails shape validation", () => {
      invalidShape = validateErrorResponseShape(invalidObj, "samples/error-response.invalid.missing-code.json");
      if (invalidShape.ok) {
        throw new Error("Unexpected PASS");
      }
    })
  );

  checks.push(
    runStep("Invalid sample reports missing error.code", () => {
      if (!invalidShape.errors.some((e) => e.includes("Missing error.code"))) {
        throw new Error("Expected 'Missing error.code' not detected");
      }
    })
  );

  const running = await startServer({ port: 0 });
  try {
    const base = "http://127.0.0.1:" + running.port;

    const successRes = await postJson(base, "/agent/run", {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "deterministic",
      maxSteps: 12,
      traceId: "verify-contract-agent-run-success-001",
    });

    checks.push(
      runStep("POST /agent/run success returns HTTP 200", () => {
        if (successRes.status !== 200) {
          throw new Error("Expected 200, got " + String(successRes.status));
        }
      })
    );

    checks.push(
      runStep("POST /agent/run success matches minimum result shape", () => {
        const shape = validateAgentRunSuccessShape(successRes.json, "/agent/run success");
        if (!shape.ok) {
          throw new Error(shape.errors.join(" | "));
        }
      })
    );

    const invalidRes = await postJson(base, "/agent/run", {
      goal: "",
      demo: "core",
      mode: "mock",
      planner: "deterministic",
      maxSteps: 12,
    });

    checks.push(
      runStep("POST /agent/run invalid request returns HTTP 400", () => {
        if (invalidRes.status !== 400) {
          throw new Error("Expected 400, got " + String(invalidRes.status));
        }
      })
    );

    checks.push(
      runStep("POST /agent/run invalid request matches error shape", () => {
        const shape = validateErrorResponseShape(invalidRes.json, "/agent/run invalid");
        if (!shape.ok) {
          throw new Error(shape.errors.join(" | "));
        }
      })
    );

    const llmStubRes = await postJson(base, "/agent/run", {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmModel: "gpt-test",
      llmTemperature: 0,
      llmMaxTokens: 256,
      llmPlanText: JSON.stringify({
        planId: "verify-contract-llm-live-stub-v1",
        version: 1,
        steps: [
          { id: "d", kind: "tool.call", toolId: "math/add", input: { a: 2, b: 3 }, outputKey: "sum" },
          { id: "b", kind: "set", key: "intent", value: "compute" },
          { id: "a", kind: "set", key: "goal", value: "sum 2 3" },
          { id: "c", kind: "append_log", value: "llm-live:planned" },
          { id: "e", kind: "append_log", value: "done" }
        ]
      }),
      maxSteps: 12,
      traceId: "verify-contract-llm-live-stub-001",
    });

    checks.push(
      runStep("POST /agent/run llm-live stub returns HTTP 200", () => {
        if (llmStubRes.status !== 200) {
          throw new Error("Expected 200, got " + String(llmStubRes.status));
        }
      })
    );

    checks.push(
      runStep("POST /agent/run llm-live stub matches minimum result shape", () => {
        const shape = validateAgentRunSuccessShape(llmStubRes.json, "/agent/run llm-live stub");
        if (!shape.ok) {
          throw new Error(shape.errors.join(" | "));
        }
      })
    );
  } finally {
    await running.close();
  }

  const overall = checks.every((c) => c.ok) ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push("# CONTRACT_STATUS");
  lines.push("");
  lines.push("## Interface Contract Verification Status");
  lines.push("");
  lines.push("- Generated (UTC): " + utcStamp());
  lines.push("- Scope: Error response samples + live `/agent/run` contract checks");
  lines.push("- Overall status: **" + overall + "**");
  lines.push("");
  lines.push("### Checks");
  lines.push("");

  for (const c of checks) {
    lines.push("#### " + c.name);
    lines.push("- Status: **" + (c.ok ? "PASS" : "FAIL") + "**");
    lines.push("- DurationMs: " + String(c.durationMs));
    if (!c.ok && c.error) {
      lines.push("- Error: " + sanitizeInline(c.error));
    }
    lines.push("");
  }

  lines.push("### Notes");
  lines.push("");
  lines.push("- JSON Schema file is present and versioned.");
  lines.push("- Validation is implemented in TypeScript for cross-platform execution.");
  lines.push("- Verification now includes live `/agent/run` success, invalid request, and `llm-live` stub checks.");
  lines.push("");

  const outPath = resolveRepoPath("CONTRACT_STATUS.md");
  writeUtf8NoBom(outPath, joinLines(lines));

  if (fileSize(outPath) < 100) {
    throw new Error("CONTRACT_STATUS.md unexpectedly small");
  }

  console.log("Contract verification", overall);
  console.log("OK: generated ->", outPath);

  if (overall !== "PASS") {
    throw new Error("One or more contract checks failed");
  }
}

void main();