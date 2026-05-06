import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const FORBIDDEN_VERTICAL_SEGMENT = "verticals/insurance-brokerage";
const ALLOWED_PUBLIC_BARREL = "src/insurance/index.ts";

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

function toRelativeSourcePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

describe("vertical public boundary", () => {
  it("requires production code outside the insurance vertical to import through the public barrel", () => {
    const violations = listFilesRecursively(SOURCE_ROOT).flatMap((filePath) => {
      const relativePath = toRelativeSourcePath(filePath);

      if (relativePath === ALLOWED_PUBLIC_BARREL) {
        return [];
      }

      if (relativePath.startsWith("src/verticals/insurance-brokerage/")) {
        return [];
      }

      const content = fs.readFileSync(filePath, "utf8");

      if (!content.includes(FORBIDDEN_VERTICAL_SEGMENT)) {
        return [];
      }

      return [{ filePath: relativePath, forbiddenSegment: FORBIDDEN_VERTICAL_SEGMENT }];
    });

    expect(violations).toEqual([]);
  });
});
