const assert = require("node:assert/strict");
const {
  ToolRegistry,
  EchoToolAdapter,
  SumToolAdapter,
  executeToolRequest,
} = require("../dist/src/tools");

async function testEchoSuccess() {
  const registry = new ToolRegistry([new EchoToolAdapter(), new SumToolAdapter()]);
  const r = await executeToolRequest(
    registry,
    { toolName: "echo", input: { message: "hola" } },
    { timeoutMs: 200, traceId: "tool-exec-001", requestId: "req-001" }
  );

  assert.equal(r.ok, true);
  assert.equal(r.toolName, "echo");
  assert.equal(r.deterministic, true);
  assert.equal(r.output.echoed, "hola");
  assert.equal(r.output.length, 4);
}

async function testSumSuccess() {
  const registry = new ToolRegistry([new EchoToolAdapter(), new SumToolAdapter()]);
  const r = await executeToolRequest(
    registry,
    { toolName: "sum", input: { values: [1, 2, 3, 4] } },
    { timeoutMs: 200 }
  );

  assert.equal(r.ok, true);
  assert.equal(r.toolName, "sum");
  assert.equal(r.output.total, 10);
  assert.equal(r.output.count, 4);
}

async function testToolNotFound() {
  const registry = new ToolRegistry([new EchoToolAdapter()]);
  const r = await executeToolRequest(
    registry,
    { toolName: "missing-tool", input: {} },
    { timeoutMs: 200 }
  );

  assert.equal(r.ok, false);
  assert.equal(r.toolName, "missing-tool");
  assert.equal(r.deterministic, true);
  assert.equal(r.error.code, "TOOL_NOT_FOUND");
}

async function testToolInvalidInput() {
  const registry = new ToolRegistry([new SumToolAdapter()]);
  const r = await executeToolRequest(
    registry,
    { toolName: "sum", input: { values: [1, "x", 3] } },
    { timeoutMs: 200 }
  );

  assert.equal(r.ok, false);
  assert.equal(r.toolName, "sum");
  assert.equal(r.error.code, "TOOL_INVALID_INPUT");
}

async function main() {
  await testEchoSuccess();
  await testSumSuccess();
  await testToolNotFound();
  await testToolInvalidInput();
  console.log("tool.executor.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});