import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type NpmPackItem = Readonly<{
  filename?: unknown;
}>;

function fail(message: string): never {
  throw new Error(message);
}

function removeLocalTarballs(): void {
  for (const entry of readdirSync(process.cwd())) {
    if (entry.endsWith(".tgz")) {
      rmSync(entry, { force: true });
    }
  }
}

function runNpmPackJson(): NpmPackItem[] {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["pack", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    fail("npm pack --json failed: " + result.error.message);
  }

  if (result.status !== 0) {
    fail(
      "npm pack --json failed with exit " +
        String(result.status) +
        "\\n" +
        String(result.stderr ?? "")
    );
  }

  const stdout = String(result.stdout ?? "").trim();
  if (stdout.length === 0) {
    fail("npm pack --json returned empty output");
  }

  const parsed = JSON.parse(stdout) as unknown;
  if (!Array.isArray(parsed) || parsed.length < 1) {
    fail("npm pack --json returned no items");
  }

  return parsed as NpmPackItem[];
}

function readString(buffer: Buffer, start: number, length: number): string {
  return buffer
    .subarray(start, start + length)
    .toString("utf8")
    .replace(/\\0.*$/u, "")
    .trim();
}

function parseTarEntriesFromGzip(tgzPath: string): string[] {
  const tar = gunzipSync(readFileSync(tgzPath));
  const entries: string[] = [];

  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    const zeroBlock = header.every((byte) => byte === 0);
    if (zeroBlock) break;

    const name = readString(header, 0, 100);
    const sizeText = readString(header, 124, 12);
    const prefix = readString(header, 345, 155);
    const path = (prefix.length > 0 ? prefix + "/" + name : name).replace(/\\\\/gu, "/");

    if (path.length > 0) {
      entries.push(path);
    }

    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isFinite(size) || size < 0) {
      fail("invalid tar entry size for " + path);
    }

    const payloadBlocks = Math.ceil(size / 512);
    offset += 512 + payloadBlocks * 512;
  }

  return entries.sort();
}

function assertContains(entries: readonly string[], path: string): void {
  if (!entries.includes(path)) {
    fail("missing from tarball: " + path);
  }
}

function assertHasPrefix(entries: readonly string[], prefix: string): void {
  if (!entries.some((entry) => entry.startsWith(prefix))) {
    fail("tarball missing " + prefix + "*");
  }
}

function assertNoPrefix(entries: readonly string[], prefix: string): void {
  const match = entries.find((entry) => entry.startsWith(prefix));
  if (match) {
    fail("tarball contains disallowed path: " + match);
  }
}

function main(): void {
  console.log("== VERIFY PACK ==");

  removeLocalTarballs();

  const items = runNpmPackJson();
  const filename = items[0]?.filename;
  if (typeof filename !== "string" || filename.trim().length === 0) {
    fail("npm pack output missing filename");
  }

  if (!existsSync(filename)) {
    fail("tgz not found: " + filename);
  }

  console.log("OK: packed -> " + filename);

  const entries = parseTarEntriesFromGzip(filename);

  console.log("\\n== TAR CONTENTS ==");
  for (const entry of entries) {
    console.log(entry);
  }

  assertContains(entries, "package/README.md");
  assertContains(entries, "package/LICENSE");
  assertContains(entries, "package/package.json");
  assertHasPrefix(entries, "package/dist/");

  assertNoPrefix(entries, "package/src/");
  assertNoPrefix(entries, "package/tests/");
  assertNoPrefix(entries, "package/scripts/");
  assertNoPrefix(entries, "package/.git/");

  rmSync(filename, { force: true });

  console.log("\\nOK: pack contents minimal, portable, and clean");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}