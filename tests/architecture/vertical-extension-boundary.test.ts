import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const PUBLIC_INSURANCE_BARREL = "src/insurance/index.ts";
const INSURANCE_VERTICAL_ROOT = "src/verticals/insurance-brokerage/";

const FORBIDDEN_CONCRETE_VERTICAL_REFERENCES = [
  "verticals/insurance-brokerage",
  "../verticals/insurance-brokerage",
  "insurance-brokerage-domain-extension",
];

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

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

function toRepoPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

describe("vertical extension boundaries", () => {
  it("keeps the neutral verticals barrel free of concrete vertical exports", () => {
    const source = readRepoFile("src/verticals/index.ts");

    expect(source).toContain("./types");
    expect(source).toContain("DomainExtension");
    expect(source).not.toContain("insurance");
    expect(source).not.toContain("brokerage");
    expect(source).not.toContain("insurance-brokerage");
  });

  it("exposes the concrete insurance extension only through the public insurance barrel", () => {
    const source = readRepoFile(PUBLIC_INSURANCE_BARREL);

    expect(source).toContain("insuranceBrokerageDomainExtension");
    expect(source).toContain(
      "../verticals/insurance-brokerage/insurance-brokerage-domain-extension",
    );
  });

  it("prevents production code from depending directly on the concrete insurance vertical extension", () => {
    const violations = listFilesRecursively(SOURCE_ROOT).flatMap((filePath) => {
      const repoPath = toRepoPath(filePath);

      if (repoPath === PUBLIC_INSURANCE_BARREL) {
        return [];
      }

      if (repoPath.startsWith(INSURANCE_VERTICAL_ROOT)) {
        return [];
      }

      const source = fs.readFileSync(filePath, "utf8");

      return FORBIDDEN_CONCRETE_VERTICAL_REFERENCES
        .filter((reference) => source.includes(reference))
        .map((reference) => ({
          filePath: repoPath,
          reference,
        }));
    });

    expect(violations).toEqual([]);
  });
});