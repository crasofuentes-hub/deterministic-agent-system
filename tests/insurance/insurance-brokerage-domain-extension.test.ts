import { describe, expect, it } from "vitest";
import { insuranceBrokerageDomainExtension } from "../../src/insurance";
import type { DomainExtension } from "../../src/verticals";

describe("insurance brokerage domain extension", () => {
  it("exposes the insurance brokerage vertical through the public insurance boundary", () => {
    const extension: DomainExtension = insuranceBrokerageDomainExtension;

    expect(extension).toMatchObject({
      id: "insurance-brokerage",
      displayName: "Insurance Brokerage",
      version: "0.1.0",
    });

    expect(extension.description).toContain("Reference vertical");
  });

  it("declares deterministic insurance capabilities without exposing vertical internals", () => {
    expect(insuranceBrokerageDomainExtension.capabilities).toEqual([
      {
        id: "insurance.coverage.query",
        kind: "query",
        description:
          "Answers deterministic insurance coverage questions through the public coverage query facade.",
      },
      {
        id: "insurance.account-manager-alerts.query",
        kind: "query",
        description:
          "Queries deterministic account manager alerts derived from payment-audit records.",
      },
      {
        id: "insurance.account-manager-alerts.model",
        kind: "model",
        description:
          "Derives deterministic missed-payment, possible-lapse, underwriting-review, and billing-discrepancy alerts.",
      },
    ]);
  });
});