import type { DomainExtension } from "../types";

export const insuranceBrokerageDomainExtension: DomainExtension = {
  id: "insurance-brokerage",
  displayName: "Insurance Brokerage",
  description:
    "Reference vertical for deterministic insurance servicing workflows behind the public insurance boundary.",
  version: "0.1.0",
  capabilities: [
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
  ],
};