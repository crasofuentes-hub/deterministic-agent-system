const test = require("node:test");
const assert = require("node:assert/strict");
const { MockSandbox } = require("../dist/src/enterprise/sandbox-utils");

test("MockSandbox executes scripted steps deterministically", async () => {
  const sb = new MockSandbox();
  sb.setScript("s1", [
    { op: "open", url: "https://example.test", result: { ok: true, value: { url: "https://example.test" } } },
    { op: "click", selector: "#login", result: { ok: true, value: { selector: "#login" } } },
    { op: "type", selector: "#user", text: "alice", result: { ok: true, value: { selector: "#user", textLen: 5 } } },
    { op: "extract", selector: "#msg", result: { ok: true, value: { selector: "#msg", text: "hello" } } }
  ]);

  const session = sb.create({ sessionId: "s1", traceId: "t1" });

  const r1 = await session.open("https://example.test");
  const r2 = await session.click("#login");
  const r3 = await session.type("#user", "alice");
  const r4 = await session.extract("#msg");

  assert.deepEqual(r1, { ok: true, value: { url: "https://example.test" } });
  assert.deepEqual(r2, { ok: true, value: { selector: "#login" } });
  assert.deepEqual(r3, { ok: true, value: { selector: "#user", textLen: 5 } });
  assert.deepEqual(r4, { ok: true, value: { selector: "#msg", text: "hello" } });

  await session.close();
});

test("MockSandbox returns INVALID_REQUEST on script mismatch", async () => {
  const sb = new MockSandbox();
  sb.setScript("s2", [
    { op: "open", url: "https://example.test", result: { ok: true, value: { url: "https://example.test" } } }
  ]);

  const session = sb.create({ sessionId: "s2" });

  // mismatch: click pero el script espera open
  const r = await session.click("#x");
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "INVALID_REQUEST");
  assert.equal(r.error.retryable, false);

  await session.close();
});
