import type { CoverageCode } from "./policy-types";

export interface CoverageCatalogEntry {
  readonly code: CoverageCode;
  readonly title: string;
  readonly plainLanguageSummary: string;
  readonly defaultExamples: readonly string[];
  readonly importantLimitations: readonly string[];
  readonly displayOrder: number;
}

export const AUTO_COVERAGE_CATALOG: readonly CoverageCatalogEntry[] = [
  {
    code: "bodily-injury-liability",
    title: "Bodily Injury Liability",
    plainLanguageSummary:
      "Helps pay for injuries to other people when the insured driver is legally responsible for a covered accident.",
    defaultExamples: [
      "If the insured driver causes a covered accident and another driver is injured, this coverage may help pay the other person's covered injury costs up to the policy limits.",
      "If there are multiple injured people in one covered accident, the per-accident limit is the maximum available for all covered bodily injury claims from that accident.",
    ],
    importantLimitations: [
      "It does not pay for injuries to the insured driver.",
      "Payment is subject to policy terms, exclusions, fault determination, and available limits.",
    ],
    displayOrder: 10,
  },
  {
    code: "property-damage-liability",
    title: "Property Damage Liability",
    plainLanguageSummary:
      "Helps pay for damage to another person's property when the insured driver is legally responsible for a covered accident.",
    defaultExamples: [
      "If the insured driver hits another vehicle and is responsible for the accident, this coverage may help pay to repair the other vehicle up to the policy limit.",
      "If the insured driver damages a fence, mailbox, or other covered property, this coverage may apply up to the policy limit.",
    ],
    importantLimitations: [
      "It does not pay to repair the insured vehicle.",
      "Payment is subject to policy terms, exclusions, fault determination, and available limits.",
    ],
    displayOrder: 20,
  },
  {
    code: "collision",
    title: "Collision",
    plainLanguageSummary:
      "Helps pay to repair or replace the insured vehicle after a covered collision, usually after the deductible is applied.",
    defaultExamples: [
      "If the insured vehicle is damaged after hitting another car, collision coverage may help pay covered repair costs after the deductible.",
      "If the insured vehicle hits a fixed object such as a pole or guardrail, collision coverage may apply subject to the deductible and policy terms.",
    ],
    importantLimitations: [
      "The deductible normally applies.",
      "It does not replace excluded losses, maintenance issues, or non-covered damage.",
    ],
    displayOrder: 30,
  },
  {
    code: "comprehensive",
    title: "Comprehensive",
    plainLanguageSummary:
      "Helps pay for covered non-collision losses to the insured vehicle, usually after the deductible is applied.",
    defaultExamples: [
      "If the insured vehicle is stolen and the claim is covered, comprehensive coverage may apply after the deductible.",
      "If the insured vehicle is damaged by vandalism, fire, hail, falling objects, or an animal impact, comprehensive coverage may apply subject to policy terms.",
    ],
    importantLimitations: [
      "The deductible normally applies.",
      "It does not cover every possible non-collision loss; exclusions and policy conditions still apply.",
    ],
    displayOrder: 40,
  },
  {
    code: "uninsured-motorist-bodily-injury",
    title: "Uninsured / Underinsured Motorist Bodily Injury",
    plainLanguageSummary:
      "May help protect covered people for bodily injury caused by a driver with no insurance or not enough insurance, depending on state rules and policy terms.",
    defaultExamples: [
      "If a covered person is injured by an uninsured at-fault driver, this coverage may help with covered injury costs up to the selected limits.",
      "If the at-fault driver's liability limits are too low, underinsured motorist coverage may apply depending on the policy and state requirements.",
    ],
    importantLimitations: [
      "Availability, stacking, offsets, and claim handling vary by state and policy.",
      "Coverage is subject to policy terms, exclusions, and required claim procedures.",
    ],
    displayOrder: 50,
  },
  {
    code: "medical-payments",
    title: "Medical Payments",
    plainLanguageSummary:
      "May help pay covered medical expenses for covered people after an auto accident, regardless of fault, subject to the selected limit.",
    defaultExamples: [
      "If a covered passenger has medical expenses after a covered accident, this coverage may help pay eligible expenses up to the limit.",
      "If the insured driver has covered medical expenses after an accident, this coverage may apply up to the selected limit.",
    ],
    importantLimitations: [
      "It is limited to covered medical expenses and selected limits.",
      "It does not replace health insurance or every possible accident-related cost.",
    ],
    displayOrder: 60,
  },
  {
    code: "rental-reimbursement",
    title: "Rental Reimbursement",
    plainLanguageSummary:
      "May help pay for a rental car while the insured vehicle is being repaired after a covered claim.",
    defaultExamples: [
      "If the insured vehicle is in the shop after a covered collision claim, this coverage may reimburse rental costs up to the daily and total limits.",
      "If the insured vehicle is repaired after a covered comprehensive claim, rental reimbursement may apply if the coverage is selected.",
    ],
    importantLimitations: [
      "Daily limits, maximum days, and total limits apply.",
      "It usually applies only after a covered comprehensive or collision claim, not for routine maintenance.",
    ],
    displayOrder: 70,
  },
  {
    code: "roadside-assistance",
    title: "Roadside Assistance",
    plainLanguageSummary:
      "May help with covered roadside events such as towing, lockout, battery jump, or flat tire service, depending on the plan.",
    defaultExamples: [
      "If the insured vehicle needs a covered tow, roadside assistance may help arrange or reimburse eligible towing service.",
      "If the insured vehicle has a dead battery, this coverage may help with a covered jump-start request.",
    ],
    importantLimitations: [
      "Service limits, distance limits, reimbursement rules, and exclusions may apply.",
      "It does not cover repairs, parts, fuel cost beyond plan terms, or every roadside event.",
    ],
    displayOrder: 80,
  },
];

export function getCoverageCatalogEntry(code: CoverageCode): CoverageCatalogEntry {
  const entry = AUTO_COVERAGE_CATALOG.find((item) => item.code === code);

  if (!entry) {
    throw new Error(`Unsupported coverage code: ${code}`);
  }

  return entry;
}