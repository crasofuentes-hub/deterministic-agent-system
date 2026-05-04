import { explainPolicyCoverages } from "./coverage-explainer";
import {
  findInsurancePolicyByPolicyId,
  listInsurancePoliciesByCustomerId,
} from "./policy-repository";
import type { InsurancePolicy, PolicyCoverageExplanationResult } from "./policy-types";

export type InsuranceCoverageServiceErrorCode =
  | "insurance.policy.not_found"
  | "insurance.customer_policy.not_found"
  | "insurance.customer_policy.ambiguous";

export interface InsuranceCoverageServiceError {
  readonly ok: false;
  readonly code: InsuranceCoverageServiceErrorCode;
  readonly message: string;
  readonly lookup: {
    readonly policyId?: string;
    readonly customerId?: string;
  };
}

export type InsuranceCoverageServiceResult =
  | PolicyCoverageExplanationResult
  | InsuranceCoverageServiceError;

function normalizeLookup(value: string): string {
  return String(value).normalize("NFC").trim().toUpperCase();
}

function explainPolicy(policy: InsurancePolicy): PolicyCoverageExplanationResult {
  return explainPolicyCoverages(policy);
}

export function explainPolicyCoveragesByPolicyId(policyId: string): InsuranceCoverageServiceResult {
  const normalizedPolicyId = normalizeLookup(policyId);

  if (normalizedPolicyId.length === 0) {
    return {
      ok: false,
      code: "insurance.policy.not_found",
      message: "Insurance policy was not found for the provided policy id.",
      lookup: {
        policyId: normalizedPolicyId,
      },
    };
  }

  const policy = findInsurancePolicyByPolicyId(normalizedPolicyId);

  if (!policy) {
    return {
      ok: false,
      code: "insurance.policy.not_found",
      message: "Insurance policy was not found for the provided policy id.",
      lookup: {
        policyId: normalizedPolicyId,
      },
    };
  }

  return explainPolicy(policy);
}

export function explainPolicyCoveragesByCustomerId(customerId: string): InsuranceCoverageServiceResult {
  const normalizedCustomerId = normalizeLookup(customerId);

  if (normalizedCustomerId.length === 0) {
    return {
      ok: false,
      code: "insurance.customer_policy.not_found",
      message: "No insurance policy was found for the provided customer id.",
      lookup: {
        customerId: normalizedCustomerId,
      },
    };
  }

  const policies = listInsurancePoliciesByCustomerId(normalizedCustomerId);

  if (policies.length === 0) {
    return {
      ok: false,
      code: "insurance.customer_policy.not_found",
      message: "No insurance policy was found for the provided customer id.",
      lookup: {
        customerId: normalizedCustomerId,
      },
    };
  }

  if (policies.length > 1) {
    return {
      ok: false,
      code: "insurance.customer_policy.ambiguous",
      message: "Multiple insurance policies were found for the provided customer id. A policy id is required.",
      lookup: {
        customerId: normalizedCustomerId,
      },
    };
  }

  const policy = policies[0];

  if (!policy) {
    return {
      ok: false,
      code: "insurance.customer_policy.not_found",
      message: "No insurance policy was found for the provided customer id.",
      lookup: {
        customerId: normalizedCustomerId,
      },
    };
  }

  return explainPolicy(policy);
}