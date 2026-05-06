import {
  explainPolicyCoveragesByCustomerId,
  explainPolicyCoveragesByPolicyId,
} from "./coverage-service";
import {
  formatCoverageServiceResponse,
  type CoverageResponseFormatResult,
} from "./coverage-response-formatter";

export interface InsuranceCoverageQuery {
  readonly policyId?: string;
  readonly customerId?: string;
}

export type InsuranceCoverageQueryResult = CoverageResponseFormatResult;

function normalizeOptional(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.normalize("NFC").trim();

  return normalized.length > 0 ? normalized : undefined;
}

export function askInsuranceCoverageQuestion(
  query: InsuranceCoverageQuery,
): InsuranceCoverageQueryResult {
  const policyId = normalizeOptional(query.policyId);
  const customerId = normalizeOptional(query.customerId);

  if (policyId) {
    return formatCoverageServiceResponse(explainPolicyCoveragesByPolicyId(policyId));
  }

  if (customerId) {
    return formatCoverageServiceResponse(explainPolicyCoveragesByCustomerId(customerId));
  }

  return {
    ok: false,
    text: "Insurance coverage lookup requires either a policy id or a customer id.",
    sections: ["Insurance coverage lookup requires either a policy id or a customer id."],
  };
}