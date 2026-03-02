const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("agent-demo CLI prints deterministic hashes", () => {
  const entry = path.join(__dirname, "..", "dist", "src", "index.js");
  const r = spawnSync(process.execPath, [entry, "agent-demo", "--mode", "mock", "--no-artifact"], { encoding: "utf8" });

  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("agent-demo PASS"));

  // parse summary JSON (find first '{' after PASS)
  const idx = r.stdout.indexOf("{");
  assert.ok(idx >= 0);
  const jsonText = r.stdout.slice(idx, r.stdout.indexOf("}\n", idx) + 2);
  const summary = JSON.parse(jsonText);

  assert.equal(summary.ok, true);
  assert.ok(/^ph[0-9a-f]{64}$/.test(summary.planHash));
  assert.ok(/^eh[0-9a-f]{64}$/.test(summary.executionHash));
  assert.ok(/^tl[0-9a-f]{64}$/.test(summary.finalTraceLinkHash));
  assert.equal(typeof summary.traceLength, "number");
});