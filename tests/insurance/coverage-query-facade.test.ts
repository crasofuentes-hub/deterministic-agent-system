import { describe, expect, it } from "vitest";
import { askInsuranceCoverageQuestion } from "../../src/insurance/coverage-query-facade";

describe("insurance coverage query facade", () => {
  it("answers a coverage question by policy id", () => {
    const result = askInsuranceCoverageQuestion({
      policyId: "POL-AUTO-1001",
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain("Policy NMA-****-1001 for Maria Alvarez");
    expect(result.text).toContain("Selected coverages: 7 of 8");
  });

  it("answers a coverage question by customer id", () => {
    const result = askInsuranceCoverageQuestion({
      customerId: "CUS-INS-1001",
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain("Policy NMA-****-1001 for Maria Alvarez");
    expect(result.text).toContain("Carrier: Northwind Mutual Auto");
  });

  it("prefers policy id when both policy id and customer id are provided", () => {
    const result = askInsuranceCoverageQuestion({
      policyId: "POL-AUTO-1001",
      customerId: "MISSING",
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain("Policy NMA-****-1001 for Maria Alvarez");
  });

  it("returns deterministic error when lookup identifiers are missing", () => {
    const result = askInsuranceCoverageQuestion({});

    expect(result).toEqual({
      ok: false,
      text: "Insurance coverage lookup requires either a policy id or a customer id.",
      sections: ["Insurance coverage lookup requires either a policy id or a customer id."],
    });
  });
});