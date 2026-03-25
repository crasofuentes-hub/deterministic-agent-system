const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { startServer } = require("../dist/src/http/server.js");

function requestText({ method, port, path, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        host: "127.0.0.1",
        port,
        path,
        headers: body
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body, "utf8"),
            }
          : undefined,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("server mounts whatsapp webhook runtime for GET verification", async () => {
  const previous = {
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_DELIVERY_MODE: process.env.WHATSAPP_DELIVERY_MODE,
  };

  process.env.WHATSAPP_VERIFY_TOKEN = "verify-token-001";
  process.env.WHATSAPP_DELIVERY_MODE = "skipped";

  const server = await startServer({ port: 0, host: "127.0.0.1" });

  try {
    const response = await requestText({
      method: "GET",
      port: server.port,
      path: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token-001&hub.challenge=abc123",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, "abc123");
  } finally {
    await server.close();
    process.env.WHATSAPP_VERIFY_TOKEN = previous.WHATSAPP_VERIFY_TOKEN;
    process.env.WHATSAPP_DELIVERY_MODE = previous.WHATSAPP_DELIVERY_MODE;
  }
});
