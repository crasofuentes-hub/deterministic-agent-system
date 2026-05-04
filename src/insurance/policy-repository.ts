import fs from "node:fs";
import path from "node:path";
import type { InsurancePolicy } from "./policy-types";

interface InsurancePolicyFixture {
  readonly policies: readonly InsurancePolicy[];
}

let cachedPolicies: readonly InsurancePolicy[] | undefined;

function normalizeId(value: string): string {
  return String(value).normalize("NFC").trim().toUpperCase();
}

function loadInsurancePolicies(): readonly InsurancePolicy[] {
  if (cachedPolicies) {
    return cachedPolicies;
  }

  const filePath = path.resolve(process.cwd(), "data/insurance-policies.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as InsurancePolicyFixture;

  cachedPolicies = parsed.policies
    .map((policy) => ({
      ...policy,
      policyId: normalizeId(policy.policyId),
      customerId: normalizeId(policy.customerId),
      carrierName: String(policy.carrierName).normalize("NFC").trim(),
      policyNumberMasked: String(policy.policyNumberMasked).normalize("NFC").trim(),
      effectiveDate: String(policy.effectiveDate).normalize("NFC").trim(),
      expirationDate: String(policy.expirationDate).normalize("NFC").trim(),
      stateCode: normalizeId(policy.stateCode),
      namedInsured: String(policy.namedInsured).normalize("NFC").trim(),
      vehicles: policy.vehicles.map((vehicle) => ({
        ...vehicle,
        vehicleId: normalizeId(vehicle.vehicleId),
        make: String(vehicle.make).normalize("NFC").trim(),
        model: String(vehicle.model).normalize("NFC").trim(),
        vinLast4:
          typeof vehicle.vinLast4 === "string"
            ? String(vehicle.vinLast4).normalize("NFC").trim()
            : undefined,
      })),
      coverages: policy.coverages.map((coverage) => ({
        ...coverage,
        limits: coverage.limits.map((limit) => ({
          label: String(limit.label).normalize("NFC").trim(),
          value: String(limit.value).normalize("NFC").trim(),
        })),
        deductible:
          typeof coverage.deductible === "string"
            ? String(coverage.deductible).normalize("NFC").trim()
            : undefined,
        premium:
          typeof coverage.premium === "string"
            ? String(coverage.premium).normalize("NFC").trim()
            : undefined,
      })),
    }))
    .sort((left, right) => left.policyId.localeCompare(right.policyId));

  return cachedPolicies;
}

export function listInsurancePolicies(): readonly InsurancePolicy[] {
  return loadInsurancePolicies();
}

export function findInsurancePolicyByPolicyId(policyId: string): InsurancePolicy | undefined {
  const normalized = normalizeId(policyId);

  if (normalized.length === 0) {
    return undefined;
  }

  return loadInsurancePolicies().find((policy) => policy.policyId === normalized);
}

export function listInsurancePoliciesByCustomerId(customerId: string): readonly InsurancePolicy[] {
  const normalized = normalizeId(customerId);

  if (normalized.length === 0) {
    return [];
  }

  return loadInsurancePolicies().filter((policy) => policy.customerId === normalized);
}