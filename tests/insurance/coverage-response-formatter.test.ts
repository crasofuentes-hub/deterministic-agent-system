import { describe, expect, it } from "vitest";
import { explainPolicyCoveragesByPolicyId } from "../../src/insurance/coverage-service";
import { formatCoverageServiceResponse } from "../../src/insurance/coverage-response-formatter";

describe("insurance coverage response formatter", () => {
  it("formats a successful coverage explanation into stable customer-facing text", () => {
    const result = explainPolicyCoveragesByPolicyId("POL-AUTO-1001");
    const formatted = formatCoverageServiceResponse(result);

    expect(formatted.ok).toBe(true);
    expect(formatted.text).toContain("Policy NMA-****-1001 for Maria Alvarez");
    expect(formatted.text).toContain("Carrier: Northwind Mutual Auto");
    expect(formatted.text).toContain("Selected coverages: 7 of 8");
    expect(formatted.text).toContain("- Collision: selected. Limits: covered vehicle actual cash value subject to policy terms. Deductible: $500.");
    expect(formatted.text).toContain("- Roadside Assistance: not selected on this policy.");
    expect(formatted.text).toContain("Example: If the insured vehicle is stolen and the claim is covered, comprehensive coverage may apply after the deductible.");
    expect(formatted.text).toContain("Important notes:");
    expect(formatted.sections.length).toBeGreaterThan(3);
  });

  it("formats deterministic not-found errors", () => {
    const result = explainPolicyCoveragesByPolicyId("missing");
    const formatted = formatCoverageServiceResponse(result);

    expect(formatted).toEqual({
      ok: false,
      text: "Insurance policy was not found for the provided policy id. Lookup: policyId=MISSING.",
      sections: [
        "Insurance policy was not found for the provided policy id. Lookup: policyId=MISSING.",
      ],
    });
  });
});