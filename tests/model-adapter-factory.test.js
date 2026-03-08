const test = require("node:test");
const assert = require("node:assert/strict");
const { createModelAdapterSelection } = require("../dist/src/integrations");

test("model-adapter-factory returns syncAdapter for mock provider", () => {
  const selection = createModelAdapterSelection({
    provider: "mock",
  });

  assert.ok(selection);
  assert.ok(selection.syncAdapter);
  assert.equal(typeof selection.syncAdapter.generate, "function");
  assert.equal(selection.asyncAdapter, undefined);
});

test("model-adapter-factory returns asyncAdapter for openai-compatible provider", () => {
  const selection = createModelAdapterSelection({
    provider: "openai-compatible",
    openaiCompatible: {
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      model: "gpt-test-compatible",
    },
  });

  assert.ok(selection);
  assert.ok(selection.asyncAdapter);
  assert.equal(typeof selection.asyncAdapter.generateAsync, "function");
  assert.equal(selection.syncAdapter, undefined);
});

test("model-adapter-factory throws stable error when openai-compatible config is missing", () => {
  assert.throws(
    () => createModelAdapterSelection({
      provider: "openai-compatible",
    }),
    /openaiCompatible config is required/
  );
});