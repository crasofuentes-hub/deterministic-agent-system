import { describe, expect, it } from "vitest";
import {
  findInsurancePolicyByPolicyId,
  listInsurancePolicies,
  listInsurancePoliciesByCustomerId,
} from "../../src/insurance/policy-repository";

describe("insurance policy repository", () => {
  it("lists insurance policies deterministically", () => {
    const policies = listInsurancePolicies();

    expect(policies.map((policy) => policy.policyId)).toEqual(["POL-AUTO-1001"]);
  });

  it("finds an insurance policy by policy id", () => {
    const policy = findInsurancePolicyByPolicyId("pol-auto-1001");

    expect(policy).toMatchObject({
      policyId: "POL-AUTO-1001",
      customerId: "CUS-INS-1001",
      carrierName: "Northwind Mutual Auto",
      lineOfBusiness: "personal-auto",
      policyNumberMasked: "NMA-****-1001",
      stateCode: "CA",
      namedInsured: "Maria Alvarez",
    });

    expect(policy?.coverages).toHaveLength(8);
  });

  it("lists insurance policies by customer id", () => {
    const policies = listInsurancePoliciesByCustomerId("cus-ins-1001");

    expect(policies.map((policy) => policy.policyId)).toEqual(["POL-AUTO-1001"]);
  });

  it("returns empty results for unknown customer id", () => {
    expect(listInsurancePoliciesByCustomerId("missing")).toEqual([]);
    expect(findInsurancePolicyByPolicyId("missing")).toBeUndefined();
  });
});