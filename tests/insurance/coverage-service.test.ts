import { describe, expect, it } from "vitest";
import {
  explainPolicyCoveragesByCustomerId,
  explainPolicyCoveragesByPolicyId,
} from "../../src/insurance/coverage-service";

describe("insurance coverage service", () => {
  it("explains policy coverages by policy id", () => {
    const result = explainPolicyCoveragesByPolicyId("pol-auto-1001");

    expect(result).toMatchObject({
      ok: true,
      policyId: "POL-AUTO-1001",
      customerId: "CUS-INS-1001",
      selectedCoverageCount: 7,
      coverageCount: 8,
    });
  });

  it("explains policy coverages by customer id when exactly one policy exists", () => {
    const result = explainPolicyCoveragesByCustomerId("cus-ins-1001");

    expect(result).toMatchObject({
      ok: true,
      policyId: "POL-AUTO-1001",
      customerId: "CUS-INS-1001",
      selectedCoverageCount: 7,
      coverageCount: 8,
    });
  });

  it("returns deterministic not found for unknown policy id", () => {
    const result = explainPolicyCoveragesByPolicyId("missing");

    expect(result).toEqual({
      ok: false,
      code: "insurance.policy.not_found",
      message: "Insurance policy was not found for the provided policy id.",
      lookup: {
        policyId: "MISSING",
      },
    });
  });

  it("returns deterministic not found for unknown customer id", () => {
    const result = explainPolicyCoveragesByCustomerId("missing");

    expect(result).toEqual({
      ok: false,
      code: "insurance.customer_policy.not_found",
      message: "No insurance policy was found for the provided customer id.",
      lookup: {
        customerId: "MISSING",
      },
    });
  });
});