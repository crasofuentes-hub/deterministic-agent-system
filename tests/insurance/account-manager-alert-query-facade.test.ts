import { describe, expect, it } from "vitest";
import { queryAccountManagerAlerts } from "../../src/insurance";

describe("insurance account manager alert query facade", () => {
  it("returns all deterministic account manager alerts by default", () => {
    const result = queryAccountManagerAlerts();

    expect(result.query).toEqual({});
    expect(result.alertCount).toBe(13);
    expect(result.alerts.map((alert) => alert.alertId)).toEqual([
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

  it("filters account manager alerts by policy id", () => {
    const result = queryAccountManagerAlerts({ policyId: "POL-904" });

    expect(result.query).toEqual({ policyId: "POL-904" });
    expect(result.alertCount).toBe(4);
    expect(result.alerts.map((alert) => [alert.type, alert.severity])).toEqual([
      ["billing-discrepancy", "high"],
      ["missed-payment", "high"],
      ["possible-lapse", "high"],
      ["underwriting-review", "medium"],
    ]);
  });

  it("filters account manager alerts by type", () => {
    const result = queryAccountManagerAlerts({ type: "possible-lapse" });

    expect(result.alertCount).toBe(2);
    expect(result.alerts.map((alert) => alert.alertId)).toEqual([
      "alert:possible-lapse:POL-902:PMT-1003",
      "alert:possible-lapse:POL-904:PMT-1007",
    ]);
  });

  it("returns an empty deterministic result when no alerts match", () => {
    const result = queryAccountManagerAlerts({ policyId: "POL-000" });

    expect(result).toEqual({
      query: { policyId: "POL-000" },
      alerts: [],
      alertCount: 0,
    });
  });
});