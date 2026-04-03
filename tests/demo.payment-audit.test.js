const { spawnSync } = require("node:child_process");
const assert = require("node:assert");

const result = spawnSync(process.execPath, ["dist/src/scripts/demo-payment-audit.js"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

assert.equal(result.status, 0, result.stderr);

const stdout = result.stdout;
assert.match(stdout, /== payment-status ==/);
assert.match(stdout, /consult-payment-status/);
assert.match(stdout, /PMT-1001/);

assert.match(stdout, /== payment-history-policy ==/);
assert.match(stdout, /consult-payment-history/);
assert.match(stdout, /POL-900/);

assert.match(stdout, /== policy-servicing ==/);
assert.match(stdout, /consult-policy-servicing/);
assert.match(stdout, /refund-timing/);

assert.match(stdout, /== payment-discrepancy ==/);
assert.match(stdout, /explain-payment-discrepancy/);
assert.match(stdout, /PMT-1007/);

assert.match(stdout, /== payment-history-customer ==/);
assert.match(stdout, /CUS-101/);