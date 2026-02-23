import fs from "node:fs";
import path from "node:path";

export function repoRoot(): string {
  return process.cwd();
}

export function resolveRepoPath(...segments: string[]): string {
  return path.join(repoRoot(), ...segments);
}

export function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function writeUtf8NoBom(filePath: string, content: string): void {
  ensureDirForFile(filePath);
  // Node writes UTF-8 without BOM by default when using string + utf8 encoding.
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function readJson<T>(filePath: string): T {
  const raw = readText(filePath);
  return JSON.parse(raw) as T;
}

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

export function assertFileExists(filePath: string): void {
  if (!exists(filePath)) {
    throw new Error("Missing required file: " + filePath);
  }
}

export function runStep(name: string, action: () => void): {
  name: string;
  ok: boolean;
  durationMs: number;
  error?: string;
} {
  const started = Date.now();
  try {
    action();
    return {
      name,
      ok: true,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      ok: false,
      durationMs: Date.now() - started,
      error: message,
    };
  }
}