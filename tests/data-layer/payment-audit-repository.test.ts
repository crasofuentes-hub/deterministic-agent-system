import { describe, expect, it } from "vitest";
import {
  findLatestPaymentAuditRecordByPolicyId,
  findPaymentAuditRecordByPaymentId,
  listPaymentAuditRecords,
  listPaymentAuditRecordsByCustomerId,
  listPaymentAuditRecordsByDiscrepancyType,
  listPaymentAuditRecordsByPolicyId,
} from "../../src/data-layer/payment-audit-repository";

describe("payment-audit-repository", () => {
  it("lists deterministic payment audit records", () => {
    const records = listPaymentAuditRecords();
    expect(records.length).toBe(5);
  });

  it("finds payment record by payment id deterministically", () => {
    expect(findPaymentAuditRecordByPaymentId("PMT-1001")).toEqual({
      paymentId: "PMT-1001",
      policyId: "POL-900",
      customerId: "CUS-100",
      paymentStatus: "posted",
      auditStatus: "reconciled",
      discrepancyType: "none",
      billingState: "current",
      servicingTopic: "document-delivery",
      servicingDisposition: "billing-review-workflow",
      updatedAtIso: "2026-03-24T00:00:00Z",
    });
  });

  it("lists multiple payment records by policy id deterministically", () => {
    const records = listPaymentAuditRecordsByPolicyId("POL-900");
    expect(records).toHaveLength(2);
    expect(records.map((item) => item.paymentId)).toEqual(["PMT-1001", "PMT-1004"]);
  });

  it("lists multiple payment records by customer id deterministically", () => {
    const records = listPaymentAuditRecordsByCustomerId("CUS-101");
    expect(records).toHaveLength(2);
    expect(records.map((item) => item.paymentId)).toEqual(["PMT-1002", "PMT-1005"]);
  });

  it("lists payment records by discrepancy type deterministically", () => {
    const records = listPaymentAuditRecordsByDiscrepancyType("balance-mismatch");
    expect(records).toHaveLength(1);
    expect(records[0]?.paymentId).toBe("PMT-1005");
  });

  it("finds latest payment record by policy id deterministically", () => {
    expect(findLatestPaymentAuditRecordByPolicyId("POL-900")?.paymentId).toBe("PMT-1004");
    expect(findLatestPaymentAuditRecordByPolicyId("POL-901")?.paymentId).toBe("PMT-1005");
  });
});