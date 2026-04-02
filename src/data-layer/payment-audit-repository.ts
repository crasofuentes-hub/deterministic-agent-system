import fs from "node:fs";
import path from "node:path";

export interface PaymentAuditRecord {
  paymentId: string;
  policyId: string;
  customerId: string;
  paymentStatus: string;
  auditStatus: string;
  discrepancyType: string;
  billingState: string;
  servicingTopic: string;
  servicingDisposition: string;
  updatedAtIso: string;
}

let cachedRecords: PaymentAuditRecord[] | undefined;

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim().toUpperCase();
}

function normalizeTag(value: string): string {
  return String(value).normalize("NFC").trim().toLowerCase();
}

function loadPaymentAuditRecords(): PaymentAuditRecord[] {
  if (cachedRecords) {
    return cachedRecords;
  }

  const filePath = path.resolve(process.cwd(), "data/payment-audit-records.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as PaymentAuditRecord[];

  cachedRecords = parsed.map((item) => ({
    paymentId: normalizeText(item.paymentId),
    policyId: normalizeText(item.policyId),
    customerId: normalizeText(item.customerId),
    paymentStatus: normalizeTag(item.paymentStatus),
    auditStatus: normalizeTag(item.auditStatus),
    discrepancyType: normalizeTag(item.discrepancyType),
    billingState: normalizeTag(item.billingState),
    servicingTopic: normalizeTag(item.servicingTopic),
    servicingDisposition: normalizeTag(item.servicingDisposition),
    updatedAtIso: String(item.updatedAtIso).normalize("NFC").trim(),
  }));

  return cachedRecords;
}

export function listPaymentAuditRecords(): PaymentAuditRecord[] {
  return loadPaymentAuditRecords();
}

export function findPaymentAuditRecordByPaymentId(
  paymentId: string
): PaymentAuditRecord | undefined {
  const normalized = normalizeText(paymentId);
  return loadPaymentAuditRecords().find((item) => item.paymentId === normalized);
}

export function listPaymentAuditRecordsByPolicyId(policyId: string): PaymentAuditRecord[] {
  const normalized = normalizeText(policyId);
  return loadPaymentAuditRecords().filter((item) => item.policyId === normalized);
}

export function listPaymentAuditRecordsByCustomerId(customerId: string): PaymentAuditRecord[] {
  const normalized = normalizeText(customerId);
  return loadPaymentAuditRecords().filter((item) => item.customerId === normalized);
}

export function listPaymentAuditRecordsByDiscrepancyType(
  discrepancyType: string
): PaymentAuditRecord[] {
  const normalized = normalizeTag(discrepancyType);
  return loadPaymentAuditRecords().filter((item) => item.discrepancyType === normalized);
}

export function findLatestPaymentAuditRecordByPolicyId(
  policyId: string
): PaymentAuditRecord | undefined {
  const records = listPaymentAuditRecordsByPolicyId(policyId)
    .slice()
    .sort((a, b) => a.updatedAtIso.localeCompare(b.updatedAtIso));

  if (records.length === 0) {
    return undefined;
  }

  return records[records.length - 1];
}