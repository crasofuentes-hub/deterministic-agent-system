"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  let port = 4319;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port") {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v <= 0 || v > 65535) {
        throw new Error("--port must be an integer in [1..65535]");
      }
      port = v;
      i += 1;
      continue;
    }
  }
  return { port };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const fixturePath = path.join(process.cwd(), "fixtures", "sandbox", "site.html");
  if (!fs.existsSync(fixturePath)) {
    throw new Error("Fixture missing: " + fixturePath);
  }
  const html = fs.readFileSync(fixturePath, "utf8");

  const server = http.createServer((req, res) => {
    const url = String(req.url || "/");

    // Serve on both "/" and "/site" (compat)
    if (req.method === "GET" && (url === "/" || url === "/site")) {
      const buf = Buffer.from(html, "utf8");
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("content-length", buf.length);
      res.end(buf);
      return;
    }

    if (req.method === "GET" && url === "/healthz") {
      const body = JSON.stringify({ ok: true });
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("content-length", Buffer.byteLength(body, "utf8"));
      res.end(body);
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Not Found");
  });

  server.listen(args.port, "127.0.0.1", () => {
    process.stdout.write(
      "sandbox fixture server on http://127.0.0.1:" + args.port + "/ (also /site)\n"
    );
  });
}

main();