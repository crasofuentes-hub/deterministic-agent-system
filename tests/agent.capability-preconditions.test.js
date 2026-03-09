const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCapabilityPipeline,
  validateCapabilityPipeline,
} = require("../dist/src/agent-run/capability-preconditions");

test("preconditions normalize select into extract -> select", () => {
  const out = normalizeCapabilityPipeline(["json.select"]);
  assert.deepEqual(out, ["json.extract", "json.select"]);
});

test("preconditions normalize merge into extract -> merge", () => {
  const out = normalizeCapabilityPipeline(["json.merge"]);
  assert.deepEqual(out, ["json.extract", "json.merge"]);
});

test("preconditions normalize normalize+merge into normalize -> extract -> merge", () => {
  const out = normalizeCapabilityPipeline(["text.normalize", "json.merge"]);
  assert.deepEqual(out, ["text.normalize", "json.extract", "json.merge"]);
});

test("preconditions validate normalized select pipeline", () => {
  const result = validateCapabilityPipeline(["json.extract", "json.select"]);
  assert.deepEqual(result, { ok: true });
});

test("preconditions reject invalid raw select pipeline without extract", () => {
  const result = validateCapabilityPipeline(["json.select"]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_EXTRACT_PRECONDITION");
});

test("preconditions reject math combined with others", () => {
  const result = validateCapabilityPipeline(["math.add", "json.extract"]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_CAPABILITY_COMBINATION");
});