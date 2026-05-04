import { getCoverageCatalogEntry } from "./coverage-catalog";
import { buildPolicySpecificExample } from "./coverage-examples";
import type { CoverageExplanation, InsurancePolicy, PolicyCoverageExplanationResult } from "./policy-types";

function sortExplanations(explanations: readonly CoverageExplanation[]): readonly CoverageExplanation[] {
  return [...explanations].sort((left, right) => {
    const leftEntry = getCoverageCatalogEntry(left.code);
    const rightEntry = getCoverageCatalogEntry(right.code);

    return leftEntry.displayOrder - rightEntry.displayOrder;
  });
}

function buildPolicySpecificExplanation(policy: InsurancePolicy, coverage: InsurancePolicy["coverages"][number]): string {
  const entry = getCoverageCatalogEntry(coverage.code);
  const limitText =
    coverage.limits.length > 0
      ? coverage.limits.map((limit) => `${limit.label}: ${limit.value}`).join("; ")
      : "no displayed limit";

  const deductibleText = coverage.deductible ? ` Deductible: ${coverage.deductible}.` : "";

  if (!coverage.selected) {
    return `${entry.title} is not selected on policy ${policy.policyNumberMasked}.`;
  }

  return `${entry.title} is selected on policy ${policy.policyNumberMasked}. Limits: ${limitText}.${deductibleText}`;
}

function buildCoverageExplanation(policy: InsurancePolicy, coverage: InsurancePolicy["coverages"][number]): CoverageExplanation {
  const entry = getCoverageCatalogEntry(coverage.code);
  const policySpecificExample = buildPolicySpecificExample(coverage.code, coverage.limits, coverage.deductible);

  return {
    code: coverage.code,
    title: entry.title,
    selected: coverage.selected,
    limits: coverage.limits,
    deductible: coverage.deductible,
    plainLanguageSummary: entry.plainLanguageSummary,
    policySpecificExplanation: buildPolicySpecificExplanation(policy, coverage),
    consistentExamples: coverage.selected ? [...entry.defaultExamples, policySpecificExample] : [],
    importantLimitations: entry.importantLimitations,
  };
}

export function explainPolicyCoverages(policy: InsurancePolicy): PolicyCoverageExplanationResult {
  const explanations = sortExplanations(policy.coverages.map((coverage) => buildCoverageExplanation(policy, coverage)));
  const selectedCoverageCount = explanations.filter((coverage) => coverage.selected).length;

  return {
    ok: true,
    policyId: policy.policyId,
    customerId: policy.customerId,
    carrierName: policy.carrierName,
    lineOfBusiness: policy.lineOfBusiness,
    policyNumberMasked: policy.policyNumberMasked,
    effectiveDate: policy.effectiveDate,
    expirationDate: policy.expirationDate,
    stateCode: policy.stateCode,
    namedInsured: policy.namedInsured,
    coverageCount: explanations.length,
    selectedCoverageCount,
    explanations,
    complianceNotes: [
      "Coverage explanations are based on the structured policy data available to this system.",
      "Actual claim decisions are subject to the carrier, policy form, endorsements, exclusions, state rules, and claim investigation.",
      "A licensed insurance professional should review coverage changes, binding decisions, or legal/coverage disputes.",
    ],
  };
}