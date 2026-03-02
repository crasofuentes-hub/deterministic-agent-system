"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(process.cwd(), "fixtures", "sandbox");
const port = Number(process.env.SANDBOX_FIXTURE_PORT || "4317");
const host = "127.0.0.1";

function send(res, status, ct, body) {
  res.statusCode = status;
  res.setHeader("content-type", ct);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    send(res, 405, "text/plain; charset=utf-8", "method not allowed");
    return;
  }
  if (req.url === "/site") {
    const p = path.join(root, "site.html");
    const html = fs.readFileSync(p, "utf8");
    send(res, 200, "text/html; charset=utf-8", html);
    return;
  }
  send(res, 404, "text/plain; charset=utf-8", "not found");
});

server.listen(port, host, () => {
  process.stdout.write("sandbox fixture server on http://" + host + ":" + port + "/site\n");
});