import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_BOUNDARY_PATHS = [
  "src/core",
  "src/agent",
  "src/agent-run",
  "src/tools",
  "src/session-state",
  "src/session-store",
  "src/storage",
  "contracts",
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".json", ".md"]);

const FORBIDDEN_DOMAIN_TERMS = [
  "insurance",
  "brokerage",
  "carrier",
  "coverage",
  "premium",
  "underwriting",
  "freeway",
  "northwind",
  "policyid",
  "policy number",
  "policynumber",
  "named insured",
  "namedinsured",
  "deductible",
];

function listFilesRecursively(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const stat = fs.statSync(root);

  if (stat.isFile()) {
    return SOURCE_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  }

  return fs
    .readdirSync(root)
    .flatMap((entry) => listFilesRecursively(path.join(root, entry)));
}

describe("core domain boundary", () => {
  it("keeps core framework paths free of insurance brokerage domain coupling", () => {
    const files = CORE_BOUNDARY_PATHS.flatMap((relativePath) =>
      listFilesRecursively(path.resolve(process.cwd(), relativePath))
    );

    const violations = files.flatMap((filePath) => {
      const content = fs.readFileSync(filePath, "utf8").toLowerCase();

      return FORBIDDEN_DOMAIN_TERMS
        .filter((term) => content.includes(term))
        .map((term) => ({
          filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
          term,
        }));
    });

    expect(violations).toEqual([]);
  });
});