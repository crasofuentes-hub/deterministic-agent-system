import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoText(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("domain-agnostic example positioning", () => {
  it("lists the domain-agnostic workflow before vertical examples in examples/README.md", () => {
    const readme = readRepoText("examples/README.md");

    const domainAgnosticIndex = readme.indexOf("examples/domain-agnostic-workflow/");
    const paymentAuditIndex = readme.indexOf("examples/payment-audit/");
    const insuranceIndex = readme.toLowerCase().indexOf("insurance");

    expect(domainAgnosticIndex).toBeGreaterThanOrEqual(0);
    expect(paymentAuditIndex).toBeGreaterThanOrEqual(0);
    expect(insuranceIndex).toBeGreaterThanOrEqual(0);

    expect(domainAgnosticIndex).toBeLessThan(paymentAuditIndex);
    expect(domainAgnosticIndex).toBeLessThan(insuranceIndex);
  });

  it("lists the domain-agnostic workflow before the payment-audit vertical in the root README examples section", () => {
    const readme = readRepoText("README.md");

    const domainAgnosticIndex = readme.indexOf("examples/domain-agnostic-workflow/");
    const paymentAuditIndex = readme.indexOf("examples/payment-audit/");

    expect(domainAgnosticIndex).toBeGreaterThanOrEqual(0);
    expect(paymentAuditIndex).toBeGreaterThanOrEqual(0);
    expect(domainAgnosticIndex).toBeLessThan(paymentAuditIndex);
  });
});