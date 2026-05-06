import type { PaymentAuditRecord } from "../../data-layer/payment-audit-repository";

export type AccountManagerAlertType =
  | "missed-payment"
  | "possible-lapse"
  | "underwriting-review"
  | "billing-discrepancy";

export type AccountManagerAlertSeverity = "low" | "medium" | "high";

export interface AccountManagerAlert {
  readonly alertId: string;
  readonly type: AccountManagerAlertType;
  readonly severity: AccountManagerAlertSeverity;
  readonly policyId: string;
  readonly customerId: string;
  readonly sourcePaymentId: string;
  readonly billingState: string;
  readonly paymentStatus: string;
  readonly auditStatus: string;
  readonly discrepancyType: string;
  readonly updatedAtIso: string;
  readonly summary: string;
  readonly recommendedAction: string;
}

function buildAlertId(record: PaymentAuditRecord, type: AccountManagerAlertType): string {
  return ["alert", type, record.policyId, record.paymentId].join(":");
}

function createMissedPaymentAlert(record: PaymentAuditRecord): AccountManagerAlert | undefined {
  if (record.paymentStatus !== "failed" && record.billingState !== "delinquent") {
    return undefined;
  }

  return {
    alertId: buildAlertId(record, "missed-payment"),
    type: "missed-payment",
    severity: "high",
    policyId: record.policyId,
    customerId: record.customerId,
    sourcePaymentId: record.paymentId,
    billingState: record.billingState,
    paymentStatus: record.paymentStatus,
    auditStatus: record.auditStatus,
    discrepancyType: record.discrepancyType,
    updatedAtIso: record.updatedAtIso,
    summary: `Payment ${record.paymentId} requires follow-up because billing state is ${record.billingState} and payment status is ${record.paymentStatus}.`,
    recommendedAction: "Contact the customer, confirm payment method, and document the next promised payment action.",
  };
}

function createPossibleLapseAlert(record: PaymentAuditRecord): AccountManagerAlert | undefined {
  if (record.billingState !== "delinquent") {
    return undefined;
  }

  return {
    alertId: buildAlertId(record, "possible-lapse"),
    type: "possible-lapse",
    severity: "high",
    policyId: record.policyId,
    customerId: record.customerId,
    sourcePaymentId: record.paymentId,
    billingState: record.billingState,
    paymentStatus: record.paymentStatus,
    auditStatus: record.auditStatus,
    discrepancyType: record.discrepancyType,
    updatedAtIso: record.updatedAtIso,
    summary: `Policy ${record.policyId} may require lapse prevention follow-up because billing state is delinquent.`,
    recommendedAction: "Start lapse-prevention outreach and escalate to a licensed servicing representative if coverage status is at risk.",
  };
}

function createUnderwritingReviewAlert(record: PaymentAuditRecord): AccountManagerAlert | undefined {
  if (record.servicingDisposition !== "manual-review-recommended") {
    return undefined;
  }

  return {
    alertId: buildAlertId(record, "underwriting-review"),
    type: "underwriting-review",
    severity: "medium",
    policyId: record.policyId,
    customerId: record.customerId,
    sourcePaymentId: record.paymentId,
    billingState: record.billingState,
    paymentStatus: record.paymentStatus,
    auditStatus: record.auditStatus,
    discrepancyType: record.discrepancyType,
    updatedAtIso: record.updatedAtIso,
    summary: `Policy ${record.policyId} has a servicing item that requires manual review.`,
    recommendedAction: "Route the case to the servicing or underwriting review queue before promising a coverage or billing resolution.",
  };
}

function createBillingDiscrepancyAlert(record: PaymentAuditRecord): AccountManagerAlert | undefined {
  if (record.discrepancyType === "none") {
    return undefined;
  }

  return {
    alertId: buildAlertId(record, "billing-discrepancy"),
    type: "billing-discrepancy",
    severity: record.auditStatus === "exception" ? "high" : "medium",
    policyId: record.policyId,
    customerId: record.customerId,
    sourcePaymentId: record.paymentId,
    billingState: record.billingState,
    paymentStatus: record.paymentStatus,
    auditStatus: record.auditStatus,
    discrepancyType: record.discrepancyType,
    updatedAtIso: record.updatedAtIso,
    summary: `Payment ${record.paymentId} has discrepancy type ${record.discrepancyType}.`,
    recommendedAction: "Review payment ledger evidence, reconcile carrier/account records, and contact the customer with a documented resolution path.",
  };
}

export function deriveAccountManagerAlertsFromPaymentRecords(
  records: readonly PaymentAuditRecord[],
): readonly AccountManagerAlert[] {
  return records
    .flatMap((record) => [
      createMissedPaymentAlert(record),
      createPossibleLapseAlert(record),
      createUnderwritingReviewAlert(record),
      createBillingDiscrepancyAlert(record),
    ])
    .filter((alert): alert is AccountManagerAlert => Boolean(alert))
    .sort((left, right) => {
      const policyCompare = left.policyId.localeCompare(right.policyId);
      if (policyCompare !== 0) {
        return policyCompare;
      }

      const dateCompare = left.updatedAtIso.localeCompare(right.updatedAtIso);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return left.alertId.localeCompare(right.alertId);
    });
}