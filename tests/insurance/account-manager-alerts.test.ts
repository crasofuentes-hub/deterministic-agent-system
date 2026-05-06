import { describe, expect, it } from "vitest";
import { listPaymentAuditRecords } from "../../src/data-layer/payment-audit-repository";
import { deriveAccountManagerAlertsFromPaymentRecords } from "../../src/verticals/insurance-brokerage/account-manager-alerts";

describe("insurance account manager alerts", () => {
  it("derives deterministic account manager alerts from payment audit records", () => {
    const alerts = deriveAccountManagerAlertsFromPaymentRecords(listPaymentAuditRecords());

    expect(alerts.map((alert) => alert.alertId)).toEqual([
      "alert:billing-discrepancy:POL-901:PMT-1002",
      "alert:underwriting-review:POL-901:PMT-1002",
      "alert:billing-discrepancy:POL-901:PMT-1005",
      "alert:underwriting-review:POL-901:PMT-1005",
      "alert:billing-discrepancy:POL-902:PMT-1003",
      "alert:missed-payment:POL-902:PMT-1003",
      "alert:possible-lapse:POL-902:PMT-1003",
      "alert:billing-discrepancy:POL-903:PMT-1006",
      "alert:underwriting-review:POL-903:PMT-1006",
      "alert:billing-discrepancy:POL-904:PMT-1007",
      "alert:missed-payment:POL-904:PMT-1007",
      "alert:possible-lapse:POL-904:PMT-1007",
      "alert:underwriting-review:POL-904:PMT-1007",
    ]);
  });

  it("creates high severity missed-payment and lapse alerts for delinquent failed payments", () => {
    const alerts = deriveAccountManagerAlertsFromPaymentRecords(listPaymentAuditRecords());
    const policyAlerts = alerts.filter((alert) => alert.policyId === "POL-904");

    expect(policyAlerts.map((alert) => [alert.type, alert.severity])).toEqual([
      ["billing-discrepancy", "high"],
      ["missed-payment", "high"],
      ["possible-lapse", "high"],
      ["underwriting-review", "medium"],
    ]);

    const missedPaymentAlert = policyAlerts.find((alert) => alert.type === "missed-payment");

    expect(missedPaymentAlert).toMatchObject({
      type: "missed-payment",
      policyId: "POL-904",
      customerId: "CUS-101",
      sourcePaymentId: "PMT-1007",
      billingState: "delinquent",
      paymentStatus: "failed",
      auditStatus: "exception",
      discrepancyType: "duplicate-charge",
      recommendedAction:
        "Contact the customer, confirm payment method, and document the next promised payment action.",
    });
  });

  it("creates lapse prevention alerts for delinquent billing states", () => {
    const alerts = deriveAccountManagerAlertsFromPaymentRecords(listPaymentAuditRecords());

    expect(
      alerts
        .filter((alert) => alert.type === "possible-lapse")
        .map((alert) => alert.alertId)
    ).toEqual([
      "alert:possible-lapse:POL-902:PMT-1003",
      "alert:possible-lapse:POL-904:PMT-1007",
    ]);
  });

  it("creates underwriting-review alerts for manual review servicing dispositions", () => {
    const alerts = deriveAccountManagerAlertsFromPaymentRecords(listPaymentAuditRecords());
    const underwritingAlerts = alerts.filter((alert) => alert.type === "underwriting-review");

    expect(underwritingAlerts.map((alert) => alert.alertId)).toEqual([
      "alert:underwriting-review:POL-901:PMT-1002",
      "alert:underwriting-review:POL-901:PMT-1005",
      "alert:underwriting-review:POL-903:PMT-1006",
      "alert:underwriting-review:POL-904:PMT-1007",
    ]);

    const underwritingAlert = underwritingAlerts.find(
      (alert) => alert.sourcePaymentId === "PMT-1005"
    );

    expect(underwritingAlert).toMatchObject({
      alertId: "alert:underwriting-review:POL-901:PMT-1005",
      severity: "medium",
      policyId: "POL-901",
      customerId: "CUS-101",
      sourcePaymentId: "PMT-1005",
      billingState: "review-required",
      paymentStatus: "posted",
      auditStatus: "exception",
      discrepancyType: "balance-mismatch",
      recommendedAction:
        "Route the case to the servicing or underwriting review queue before promising a coverage or billing resolution.",
    });
  });
});