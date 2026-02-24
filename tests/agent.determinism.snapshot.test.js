const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { executeDeterministicPlan } = require("../dist/src/agent");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

function main() {
  const fixturePath = path.join(__dirname, "..", "fixtures", "determinism", "fixture.v1.json");
  const fixture = readJson(fixturePath);

  const r1 = executeDeterministicPlan(fixture.plan, fixture.options);
  const r2 = executeDeterministicPlan(fixture.plan, fixture.options);

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);

  if (!r1.ok || !r2.ok) throw new Error("Unexpected non-ok execution");

  // invariantes intra-run
  assert.equal(r1.result.planHash, r2.result.planHash);
  assert.equal(r1.result.executionHash, r2.result.executionHash);
  assert.equal(r1.result.finalTraceLinkHash, r2.result.finalTraceLinkHash);
  assert.deepEqual(r1.result.finalState, r2.result.finalState);
  assert.deepEqual(r1.result.trace, r2.result.trace);

  const actual = {
    fixtureId: fixture.fixtureId,
    traceSchemaVersion: r1.result.traceSchemaVersion,
    planHash: r1.result.planHash,
    executionHash: r1.result.executionHash,
    finalTraceLinkHash: r1.result.finalTraceLinkHash,
    finalState: r1.result.finalState,
    traceLength: r1.result.trace.length,
  };

  const snapshotPath = path.join(__dirname, "..", "fixtures", "determinism", "snapshot.v1.json");

  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, JSON.stringify(actual, null, 2));
    console.log("determinism snapshot created:", snapshotPath);
    console.log(
      JSON.stringify(
        {
          ok: true,
          createdSnapshot: true,
          runtime: { node: process.version, platform: process.platform, arch: process.arch },
          actual,
        },
        null,
        2
      )
    );
    return;
  }

  const expected = readJson(snapshotPath);

  assert.equal(
    stableStringify(actual),
    stableStringify(expected),
    [
      "Determinism snapshot mismatch.",
      "Expected and actual differ.",
      "Runtime:",
      JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch }),
      "Actual:",
      JSON.stringify(actual, null, 2),
      "Expected:",
      JSON.stringify(expected, null, 2),
    ].join("\n")
  );

  const report = {
    ok: true,
    createdSnapshot: false,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      eol: JSON.stringify(os.EOL),
    },
    verified: {
      fixtureId: actual.fixtureId,
      traceSchemaVersion: actual.traceSchemaVersion,
      planHash: actual.planHash,
      executionHash: actual.executionHash,
      finalTraceLinkHash: actual.finalTraceLinkHash,
      traceLength: actual.traceLength,
    },
  };

  const outDir = path.join(__dirname, "..", "artifacts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(
    outDir,
    "determinism-report-" +
      process.platform +
      "-" +
      process.arch +
      "-" +
      process.version.replace(/^v/, "") +
      ".json"
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("agent.determinism.snapshot.test PASS");
  console.log(JSON.stringify(report, null, 2));
}

main();
