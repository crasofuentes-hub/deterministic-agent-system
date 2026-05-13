import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * These are core runtime/framework directories.
 *
 * Application composition layers such as customer-service-agent, customer-service-api,
 * channels, HTTP handlers, examples, and scripts are intentionally excluded here.
 *
 * Those layers may compose optional verticals through public boundaries.
 * Core runtime modules must not import any vertical, including the public insurance barrel.
 */
const CORE_RUNTIME_DIRECTORIES = [
  "src/agent",
  "src/agent-run",
  "src/core",
  "src/journal",
  "src/planner",
  "src/prompts",
  "src/queue",
  "src/replay",
  "src/session-state",
  "src/session-store",
  "src/storage",
  "src/tools",
];

const FORBIDDEN_CORE_IMPORT_PATTERNS = [
  /from\s+["'][^"']*\/insurance(?:\/[^"']*)?["']/,
  /from\s+["'][^"']*\/verticals\/insurance(?:\/[^"']*)?["']/,
  /from\s+["'][^"']*\/verticals\/insurance-brokerage(?:\/[^"']*)?["']/,
  /import\s*\([^)]*["'][^"']*\/insurance(?:\/[^"']*)?["'][^)]*\)/,
  /import\s*\([^)]*["'][^"']*\/verticals\/insurance(?:\/[^"']*)?["'][^)]*\)/,
  /import\s*\([^)]*["'][^"']*\/verticals\/insurance-brokerage(?:\/[^"']*)?["'][^)]*\)/,
  /require\s*\([^)]*["'][^"']*\/insurance(?:\/[^"']*)?["'][^)]*\)/,
  /require\s*\([^)]*["'][^"']*\/verticals\/insurance(?:\/[^"']*)?["'][^)]*\)/,
  /require\s*\([^)]*["'][^"']*\/verticals\/insurance-brokerage(?:\/[^"']*)?["'][^)]*\)/,
];

const SOURCE_ROOT = "src";
const FORBIDDEN_VERTICAL_IMPLEMENTATION_SEGMENT = "verticals/insurance-brokerage";
const ALLOWED_INSURANCE_PUBLIC_BARREL = "src/insurance/index.ts";

function walkTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkTypeScriptFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePath(file: string): string {
  return relative(process.cwd(), file).replace(/\\/g, "/");
}

function findCoreRuntimeVerticalImports(): string[] {
  const violations: string[] = [];

  for (const directory of CORE_RUNTIME_DIRECTORIES) {
    for (const file of walkTypeScriptFiles(directory)) {
      const normalized = normalizePath(file);
      const text = readFileSync(file, "utf8");

      for (const pattern of FORBIDDEN_CORE_IMPORT_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(normalized + " matches " + String(pattern));
        }
      }
    }
  }

  return violations.sort((left, right) => left.localeCompare(right));
}

function findDirectVerticalImplementationImportsOutsideBoundary(): string[] {
  const violations: string[] = [];

  for (const file of walkTypeScriptFiles(SOURCE_ROOT)) {
    const normalized = normalizePath(file);

    if (normalized === ALLOWED_INSURANCE_PUBLIC_BARREL) {
      continue;
    }

    if (normalized.startsWith("src/verticals/insurance-brokerage/")) {
      continue;
    }

    const text = readFileSync(file, "utf8");

    if (text.includes(FORBIDDEN_VERTICAL_IMPLEMENTATION_SEGMENT)) {
      violations.push(normalized + " imports " + FORBIDDEN_VERTICAL_IMPLEMENTATION_SEGMENT);
    }
  }

  return violations.sort((left, right) => left.localeCompare(right));
}

describe("core to vertical import audit", () => {
  it("prevents core runtime modules from importing insurance verticals or public insurance boundary", () => {
    expect(findCoreRuntimeVerticalImports()).toEqual([]);
  });

  it("prevents non-vertical production code from importing insurance vertical implementation directly", () => {
    expect(findDirectVerticalImplementationImportsOutsideBoundary()).toEqual([]);
  });

  it("keeps application composition layers outside the strict core runtime directory list", () => {
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/customer-service-agent");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/customer-service-api");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/channels");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/http");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/scripts");
  });

  it("keeps vertical implementation outside the core runtime directory list", () => {
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/insurance");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/verticals");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/verticals/insurance");
    expect(CORE_RUNTIME_DIRECTORIES).not.toContain("src/verticals/insurance-brokerage");
  });
});