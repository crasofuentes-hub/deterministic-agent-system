import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DomainExtension } from "../../src/verticals";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("domain extension contract", () => {
  it("provides a domain-agnostic vertical extension shape", () => {
    const extension: DomainExtension = {
      id: "example-domain",
      displayName: "Example Domain",
      description: "Example domain extension used to validate the generic contract.",
      version: "0.1.0",
      capabilities: [
        {
          id: "example-query",
          kind: "query",
          description: "Example query capability.",
        },
        {
          id: "example-workflow",
          kind: "workflow",
          description: "Example workflow capability.",
        },
        {
          id: "example-model",
          kind: "model",
          description: "Example model capability.",
        },
        {
          id: "example-integration",
          kind: "integration",
          description: "Example integration capability.",
        },
      ],
    };

    expect(extension.capabilities.map((capability) => capability.kind)).toEqual([
      "query",
      "workflow",
      "model",
      "integration",
    ]);
  });

  it("keeps the vertical extension contract free of insurance-specific terms", () => {
    const source = readRepoFile("src/verticals/types.ts").toLowerCase();

    expect(source).not.toContain("insurance");
    expect(source).not.toContain("brokerage");
    expect(source).not.toContain("policy");
    expect(source).not.toContain("payment");
    expect(source).not.toContain("coverage");
    expect(source).not.toContain("customer");
  });

  it("exposes the contract through the neutral verticals barrel", () => {
    const source = readRepoFile("src/verticals/index.ts");

    expect(source).toContain("DomainExtension");
    expect(source).toContain("./types");
    expect(source).not.toContain("insurance-brokerage");
  });
});