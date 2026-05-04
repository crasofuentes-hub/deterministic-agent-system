import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { explainPolicyCoverages } from "../../src/insurance/coverage-explainer";
import type { InsurancePolicy } from "../../src/insurance/policy-types";

interface InsurancePolicyFixture {
  readonly policies: readonly InsurancePolicy[];
}

function loadFixturePolicy(policyId: string): InsurancePolicy {
  const fixturePath = join(process.cwd(), "data", "insurance-policies.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as InsurancePolicyFixture;
  const policy = fixture.policies.find((item) => item.policyId === policyId);

  if (!policy) {
    throw new Error(`Missing fixture policy: ${policyId}`);
  }

  return policy;
}

describe("insurance coverage explainer", () => {
  it("explains selected auto policy coverages deterministically with limits, deductibles, examples, and guardrails", () => {
    const policy = loadFixturePolicy("POL-AUTO-1001");

    const result = explainPolicyCoverages(policy);

    expect(result).toMatchObject({
      ok: true,
      policyId: "POL-AUTO-1001",
      customerId: "CUS-INS-1001",
      carrierName: "Northwind Mutual Auto",
      lineOfBusiness: "personal-auto",
      policyNumberMasked: "NMA-****-1001",
      selectedCoverageCount: 7,
      coverageCount: 8,
    });

    expect(result.explanations.map((coverage) => coverage.code)).toEqual([
      "bodily-injury-liability",
      "property-damage-liability",
      "collision",
      "comprehensive",
      "uninsured-motorist-bodily-injury",
      "medical-payments",
      "rental-reimbursement",
      "roadside-assistance",
    ]);

    const collision = result.explanations.find((coverage) => coverage.code === "collision");

    expect(collision).toMatchObject({
      title: "Collision",
      selected: true,
      deductible: "$500",
      limits: [
        {
          label: "covered vehicle",
          value: "actual cash value subject to policy terms",
        },
      ],
    });

    expect(collision?.policySpecificExplanation).toContain("Deductible: $500.");
    expect(collision?.consistentExamples.join(" ")).toContain("covered collision claim");

    const comprehensive = result.explanations.find((coverage) => coverage.code === "comprehensive");

    expect(comprehensive?.consistentExamples.join(" ")).toContain("theft");
    expect(comprehensive?.consistentExamples.join(" ")).toContain("vandalism");
    expect(comprehensive?.consistentExamples.join(" ")).toContain("animal");

    const roadside = result.explanations.find((coverage) => coverage.code === "roadside-assistance");

    expect(roadside).toMatchObject({
      title: "Roadside Assistance",
      selected: false,
      limits: [],
      consistentExamples: [],
      policySpecificExplanation: "Roadside Assistance is not selected on policy NMA-****-1001.",
    });

    expect(result.complianceNotes).toEqual([
      "Coverage explanations are based on the structured policy data available to this system.",
      "Actual claim decisions are subject to the carrier, policy form, endorsements, exclusions, state rules, and claim investigation.",
      "A licensed insurance professional should review coverage changes, binding decisions, or legal/coverage disputes.",
    ]);
  });
});