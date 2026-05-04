import type { CoverageCode, CoverageLimit } from "./policy-types";

function formatLimits(limits: readonly CoverageLimit[]): string {
  if (limits.length === 0) {
    return "no displayed limit";
  }

  return limits.map((limit) => `${limit.label}: ${limit.value}`).join("; ");
}

export function buildPolicySpecificExample(
  code: CoverageCode,
  limits: readonly CoverageLimit[],
  deductible: string | undefined,
): string {
  const limitText = formatLimits(limits);
  const deductibleText = deductible ? ` with a ${deductible} deductible` : "";

  switch (code) {
    case "bodily-injury-liability":
      return `With ${limitText}, the policy can respond to covered injuries to others up to those liability limits when the insured driver is legally responsible.`;

    case "property-damage-liability":
      return `With ${limitText}, the policy can respond to covered damage to someone else's property up to the property damage liability limit.`;

    case "collision":
      return `With ${limitText}${deductibleText}, a covered collision claim would normally apply the deductible before covered vehicle repair or replacement payment.`;

    case "comprehensive":
      return `With ${limitText}${deductibleText}, a covered theft, vandalism, fire, hail, animal, or falling-object claim would normally apply the deductible before covered payment.`;

    case "uninsured-motorist-bodily-injury":
      return `With ${limitText}, the policy may respond to covered bodily injury caused by an uninsured or underinsured driver, subject to state and policy rules.`;

    case "medical-payments":
      return `With ${limitText}, the policy may help pay eligible covered medical expenses after an auto accident up to the selected limit.`;

    case "rental-reimbursement":
      return `With ${limitText}, the policy may reimburse eligible rental car costs after a covered claim, subject to daily and total limits.`;

    case "roadside-assistance":
      return `With ${limitText}, the policy may help with covered roadside events subject to plan limits and service rules.`;
  }
}