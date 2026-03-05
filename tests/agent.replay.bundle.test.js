const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { executeForReplay, verifyReplayBundle } = require("../dist/src/agent/replay/replay");
const { buildReplayBundle, replayBundleToJson } = require("../dist/src/agent/replay/bundle");

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

test("replay bundle JSON is deterministic and verifies hashes", async () => {
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

  const b1 = buildReplayBundle({ planner: "llm-mock", input, result: r1.result });
  const b2 = buildReplayBundle({ planner: "llm-mock", input, result: r2.result });

  const j1 = replayBundleToJson(b1);
  const j2 = replayBundleToJson(b2);

  assert.equal(sha256(j1), sha256(j2), "bundle JSON must be identical across repeats");

  const verify = await verifyReplayBundle(JSON.parse(j1));
  assert.equal(verify.ok, true);
});