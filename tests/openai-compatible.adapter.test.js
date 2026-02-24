const assert = require("node:assert/strict");
const { OpenAICompatibleModelAdapter } = require("../dist/src/integrations");

class MockTransport {
  constructor(responseFactory) {
    this._responseFactory = responseFactory;
    this.calls = [];
  }

  async request(req) {
    this.calls.push(req);
    return this._responseFactory(req);
  }
}

async function testOpenAICompatibleSuccess() {
  const transport = new MockTransport(() => ({
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify({
      id: "chatcmpl-test",
      model: "gpt-test-compatible",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hello deterministic world" },
          finish_reason: "stop",
        },
      ],
      usage: { total_tokens: 12, prompt_tokens: 5, completion_tokens: 7 },
    }),
  }));

  const adapter = new OpenAICompatibleModelAdapter(
    {
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
      model: "gpt-test-compatible",
    },
    transport
  );

  const out = await adapter.generateAsync({
    prompt: "hi",
    maxTokens: 32,
    temperature: 0,
  });

  assert.equal(out.deterministic, false);
  assert.equal(out.modelId, "gpt-test-compatible");
  assert.equal(out.text, "hello deterministic world");
  assert.equal(out.tokenCount, 12);
  assert.equal(out.evidence.providerKind, "openai-compatible");
  assert.equal(out.evidence.httpStatus, 200);
  assert.equal(typeof out.evidence.requestFingerprint, "string");
  assert.equal(typeof out.evidence.responseFingerprint, "string");

  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].method, "POST");
  assert.equal(transport.calls[0].url, "https://example.test/v1/chat/completions");
}

async function testOpenAICompatibleProviderHttpError() {
  const transport = new MockTransport(() => ({
    status: 401,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify({ error: { message: "Unauthorized" } }),
  }));

  const adapter = new OpenAICompatibleModelAdapter(
    {
      baseUrl: "https://example.test/v1",
      apiKey: "bad",
      model: "gpt-test-compatible",
    },
    transport
  );

  await assert.rejects(
    () => adapter.generateAsync({ prompt: "hi", maxTokens: 10, temperature: 0 }),
    /Provider HTTP error: 401/
  );
}

async function main() {
  await testOpenAICompatibleSuccess();
  await testOpenAICompatibleProviderHttpError();
  console.log("openai-compatible.adapter.test PASS");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
