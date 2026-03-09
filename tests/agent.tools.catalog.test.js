const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAgentToolRegistry,
  listAgentToolInfo,
} = require("../dist/src/agent/tools");

test("agent tool catalog yields deterministic registry and info", () => {
  const reg1 = createAgentToolRegistry();
  const reg2 = createAgentToolRegistry();

  assert.deepEqual(reg1.listIds(), reg2.listIds());

  const info = listAgentToolInfo();
  assert.deepEqual(info, [
    { id: "echo", version: 1 },
    { id: "json/extract", version: 1 },
    { id: "json/select-keys", version: 1 },
    { id: "math/add", version: 1 },
    { id: "text/normalize", version: 1 }
  ]);
});