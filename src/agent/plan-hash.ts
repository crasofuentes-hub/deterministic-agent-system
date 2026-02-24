import type { DeterministicAgentPlan } from "./plan-types";
import { toCanonicalPlanJson } from "./canonical-plan";
import { prefixedSha256 } from "./crypto-hash";

export function computeDeterministicPlanHash(plan: DeterministicAgentPlan): string {
  return prefixedSha256("ph", toCanonicalPlanJson(plan));
}
