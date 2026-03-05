const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { executeForReplay, verifyReplayBundle } = require("../dist/src/agent/replay/replay");
const { buildReplayBundleV2, replayBundleToJson } = require("../dist/src/agent/replay/bundle");
const { buildReplayManifest } = require("../dist/src/agent/replay/manifest");

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

test("replay bundle v2 JSON is deterministic and verifies hashes (includes manifest)", async () => {
  const input = {
    goal: "sum 2 3",
    demo: "core",
    mode: "mock",
    planner: "llm-mock",
    maxSteps: 12,
    traceId: "replay-test-001"
  };

  const r1 = await executeForReplay(input, "llm-mock");
  const r2 = await executeForReplay(input, "llm-mock");

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  const m1 = buildReplayManifest({ planner: "llm-mock", traceSchemaVersion: r1.result.traceSchemaVersion });
  const m2 = buildReplayManifest({ planner: "llm-mock", traceSchemaVersion: r2.result.traceSchemaVersion });

  const b1 = buildReplayBundleV2({ planner: "llm-mock", input, result: r1.result, manifest: m1 });
  const b2 = buildReplayBundleV2({ planner: "llm-mock", input, result: r2.result, manifest: m2 });

  const j1 = replayBundleToJson(b1);
  const j2 = replayBundleToJson(b2);

  assert.equal(sha256(j1), sha256(j2), "bundle JSON must be identical across repeats on same env");

  const parsed = JSON.parse(j1);

  assert.equal(parsed.schema, "deterministic-agent-system.replay-bundle");
  assert.equal(parsed.version, 2);

  assert.ok(parsed.manifest);
  assert.equal(typeof parsed.manifest.nodeVersion, "string");
  assert.equal(typeof parsed.manifest.platform, "string");
  assert.equal(typeof parsed.manifest.arch, "string");
  assert.equal(typeof parsed.manifest.packageName, "string");
  assert.equal(typeof parsed.manifest.packageVersion, "string");
  assert.equal(typeof parsed.manifest.traceSchemaVersion, "number");

  assert.ok(Array.isArray(parsed.manifest.tools));
  assert.ok(parsed.manifest.tools.length >= 2);

  // Tools must be sorted by id
  const ids = parsed.manifest.tools.map((t) => t.id);
  const sorted = ids.slice().sort();
  assert.deepEqual(ids, sorted);

  const verify = await verifyReplayBundle(parsed);
  assert.equal(verify.ok, true);
});