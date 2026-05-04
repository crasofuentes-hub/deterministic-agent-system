export type InsuranceLineOfBusiness = "personal-auto" | "renters" | "homeowners" | "business";

export type CoverageCode =
  | "bodily-injury-liability"
  | "property-damage-liability"
  | "collision"
  | "comprehensive"
  | "uninsured-motorist-bodily-injury"
  | "medical-payments"
  | "rental-reimbursement"
  | "roadside-assistance";

export interface CoverageLimit {
  readonly label: string;
  readonly value: string;
}

export interface PolicyCoverage {
  readonly code: CoverageCode;
  readonly selected: boolean;
  readonly limits: readonly CoverageLimit[];
  readonly deductible?: string;
  readonly premium?: string;
}

export interface InsuredVehicle {
  readonly vehicleId: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly vinLast4?: string;
}

export interface InsurancePolicy {
  readonly policyId: string;
  readonly customerId: string;
  readonly carrierName: string;
  readonly lineOfBusiness: InsuranceLineOfBusiness;
  readonly policyNumberMasked: string;
  readonly effectiveDate: string;
  readonly expirationDate: string;
  readonly stateCode: string;
  readonly namedInsured: string;
  readonly vehicles: readonly InsuredVehicle[];
  readonly coverages: readonly PolicyCoverage[];
}

export interface CoverageExplanation {
  readonly code: CoverageCode;
  readonly title: string;
  readonly selected: boolean;
  readonly limits: readonly CoverageLimit[];
  readonly deductible?: string;
  readonly plainLanguageSummary: string;
  readonly policySpecificExplanation: string;
  readonly consistentExamples: readonly string[];
  readonly importantLimitations: readonly string[];
}

export interface PolicyCoverageExplanationResult {
  readonly ok: true;
  readonly policyId: string;
  readonly customerId: string;
  readonly carrierName: string;
  readonly lineOfBusiness: InsuranceLineOfBusiness;
  readonly policyNumberMasked: string;
  readonly effectiveDate: string;
  readonly expirationDate: string;
  readonly stateCode: string;
  readonly namedInsured: string;
  readonly coverageCount: number;
  readonly selectedCoverageCount: number;
  readonly explanations: readonly CoverageExplanation[];
  readonly complianceNotes: readonly string[];
}