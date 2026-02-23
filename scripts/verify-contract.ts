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

function main(): void {
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

  const readValid = runStep("Read valid sample JSON", () => {
    validObj = readJson<unknown>(validPath);
  });
  checks.push(readValid);

  const readInvalid = runStep("Read invalid sample JSON", () => {
    invalidObj = readJson<unknown>(invalidPath);
  });
  checks.push(readInvalid);

  let validShape: ShapeResult = { source: "valid", ok: false, errors: ["Not executed"] };
  let invalidShape: ShapeResult = { source: "invalid", ok: false, errors: ["Not executed"] };

  const validateValid = runStep("Valid sample passes shape validation", () => {
    validShape = validateErrorResponseShape(validObj, "samples/error-response.valid.json");
    if (!validShape.ok) {
      throw new Error(validShape.errors.join(" | "));
    }
  });
  checks.push(validateValid);

  const validateInvalid = runStep("Invalid sample fails shape validation", () => {
    invalidShape = validateErrorResponseShape(invalidObj, "samples/error-response.invalid.missing-code.json");
    if (invalidShape.ok) {
      throw new Error("Unexpected PASS");
    }
  });
  checks.push(validateInvalid);

  const detectMissingCode = runStep("Invalid sample reports missing error.code", () => {
    if (!invalidShape.errors.some((e) => e.includes("Missing error.code"))) {
      throw new Error("Expected 'Missing error.code' not detected");
    }
  });
  checks.push(detectMissingCode);

  const overall = checks.every((c) => c.ok) ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push("# CONTRACT_STATUS");
  lines.push("");
  lines.push("## Interface Contract Verification Status");
  lines.push("");
  lines.push("- Generated (UTC): " + utcStamp());
  lines.push("- Scope: Deterministic error response shape checks (TypeScript validator + JSON samples)");
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
  lines.push("- This is a foundation for expanded contract and negative-path testing.");
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

main();