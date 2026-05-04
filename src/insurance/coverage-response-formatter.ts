import type { InsuranceCoverageServiceResult } from "./coverage-service";
import type { CoverageExplanation, PolicyCoverageExplanationResult } from "./policy-types";

export interface CoverageResponseFormatResult {
  readonly ok: boolean;
  readonly text: string;
  readonly sections: readonly string[];
}

function formatCoverageLine(coverage: CoverageExplanation): string {
  if (!coverage.selected) {
    return `- ${coverage.title}: not selected on this policy.`;
  }

  const limitText =
    coverage.limits.length > 0
      ? coverage.limits.map((limit) => `${limit.label} ${limit.value}`).join("; ")
      : "no displayed limit";

  const deductibleText = coverage.deductible ? ` Deductible: ${coverage.deductible}.` : "";

  return `- ${coverage.title}: selected. Limits: ${limitText}.${deductibleText}`;
}

function formatCoverageDetail(coverage: CoverageExplanation): string {
  const examples =
    coverage.consistentExamples.length > 0
      ? coverage.consistentExamples.map((example) => `  Example: ${example}`).join("\n")
      : "  Example: No example is provided because this coverage is not selected.";

  const limitations = coverage.importantLimitations
    .map((limitation) => `  Limitation: ${limitation}`)
    .join("\n");

  return [
    `${coverage.title}`,
    coverage.plainLanguageSummary,
    coverage.policySpecificExplanation,
    examples,
    limitations,
  ].join("\n");
}

function formatSuccess(result: PolicyCoverageExplanationResult): CoverageResponseFormatResult {
  const summaryLines = [
    `Policy ${result.policyNumberMasked} for ${result.namedInsured}`,
    `Carrier: ${result.carrierName}`,
    `Term: ${result.effectiveDate} to ${result.expirationDate}`,
    `State: ${result.stateCode}`,
    `Selected coverages: ${result.selectedCoverageCount} of ${result.coverageCount}`,
    "",
    "Coverage summary:",
    ...result.explanations.map(formatCoverageLine),
  ];

  const detailSections = result.explanations.map(formatCoverageDetail);

  const complianceSection = ["Important notes:", ...result.complianceNotes.map((note) => `- ${note}`)];

  const sections = [
    summaryLines.join("\n"),
    ...detailSections,
    complianceSection.join("\n"),
  ];

  return {
    ok: true,
    text: sections.join("\n\n"),
    sections,
  };
}

function formatError(result: Extract<InsuranceCoverageServiceResult, { ok: false }>): CoverageResponseFormatResult {
  const lookupParts = [
    result.lookup.policyId ? `policyId=${result.lookup.policyId}` : undefined,
    result.lookup.customerId ? `customerId=${result.lookup.customerId}` : undefined,
  ].filter((value): value is string => typeof value === "string");

  const lookupText = lookupParts.length > 0 ? ` Lookup: ${lookupParts.join(", ")}.` : "";

  return {
    ok: false,
    text: `${result.message}${lookupText}`,
    sections: [`${result.message}${lookupText}`],
  };
}

export function formatCoverageServiceResponse(
  result: InsuranceCoverageServiceResult,
): CoverageResponseFormatResult {
  if (result.ok) {
    return formatSuccess(result);
  }

  return formatError(result);
}