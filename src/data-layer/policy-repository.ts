import fs from "node:fs";
import path from "node:path";

export interface PolicyRecord {
  policyTopic: string;
  title: string;
  summary: string;
  returnWindowDays?: number;
  refundProcessingBusinessDaysMin?: number;
  refundProcessingBusinessDaysMax?: number;
  cancellationBeforeShipmentOnly?: boolean;
  allowedActions: string[];
  disallowedActions: string[];
}

let cachedPolicies: PolicyRecord[] | undefined;

function loadPolicies(): PolicyRecord[] {
  if (cachedPolicies) {
    return cachedPolicies;
  }

  const filePath = path.resolve(process.cwd(), "data/policies.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as PolicyRecord[];

  cachedPolicies = parsed.map((item) => ({
    policyTopic: String(item.policyTopic).normalize("NFC").trim().toLowerCase(),
    title: String(item.title).normalize("NFC").trim(),
    summary: String(item.summary).normalize("NFC").trim(),
    returnWindowDays:
      typeof item.returnWindowDays === "number" ? item.returnWindowDays : undefined,
    refundProcessingBusinessDaysMin:
      typeof item.refundProcessingBusinessDaysMin === "number"
        ? item.refundProcessingBusinessDaysMin
        : undefined,
    refundProcessingBusinessDaysMax:
      typeof item.refundProcessingBusinessDaysMax === "number"
        ? item.refundProcessingBusinessDaysMax
        : undefined,
    cancellationBeforeShipmentOnly:
      typeof item.cancellationBeforeShipmentOnly === "boolean"
        ? item.cancellationBeforeShipmentOnly
        : undefined,
    allowedActions: item.allowedActions.map((value) =>
      String(value).normalize("NFC").trim().toLowerCase()
    ),
    disallowedActions: item.disallowedActions.map((value) =>
      String(value).normalize("NFC").trim().toLowerCase()
    ),
  }));

  return cachedPolicies;
}

export function findPolicyByTopic(policyTopic: string): PolicyRecord | undefined {
  const normalized = String(policyTopic).normalize("NFC").trim().toLowerCase();

  if (normalized.length === 0) {
    return undefined;
  }

  return loadPolicies().find((item) => item.policyTopic === normalized);
}