import { describe, expect, it } from "vitest";
import {
  findLatestPaymentAuditRecordByPolicyId,
  findPaymentAuditRecordByPaymentId,
  listPaymentAuditRecords,
  listPaymentAuditRecordsByPolicyId,
} from "../../src/data-layer/payment-audit-repository";

describe("payment-audit-repository", () => {
  it("lists deterministic payment audit records", () => {
    const records = listPaymentAuditRecords();
    expect(records.length).toBe(3);
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

  it("lists payment records by policy id deterministically", () => {
    const records = listPaymentAuditRecordsByPolicyId("POL-900");
    expect(records).toHaveLength(1);
    expect(records[0]?.paymentId).toBe("PMT-1001");
  });

  it("finds latest payment record by policy id deterministically", () => {
    expect(findLatestPaymentAuditRecordByPolicyId("POL-901")?.paymentId).toBe("PMT-1002");
  });
});