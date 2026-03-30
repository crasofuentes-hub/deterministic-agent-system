import { describe, expect, it } from "vitest";
import { runCustomerServiceApi } from "../../src/customer-service-api/customer-service-api";

describe("customer-service-agent e2e", () => {
  it("returns real estimated premium data end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-001",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the price of Personal Auto Standard?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:00:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-001",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-price",
      responseId: "consult-price-resolved",
      responseText: "Product: Personal Auto Standard | Price: 128.50 USD",
      stage: "resolve-price",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns real request status end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-002",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-12345?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:05:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-002",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "Order ORDER-12345 is currently under-review. Last update: 2026-03-10T10:00:00Z. No additional action is required at this time.",
      stage: "resolve-order-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("persists session across turns and returns real coverage option knowledge", () => {
    const first = runCustomerServiceApi({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "I want information about a product",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:10:00Z",
    });

    expect(first).toEqual({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-missing-product-name",
      responseText: "Please provide the coverage option name so I can help you.",
      stage: "collect-product-name",
      status: "missing-entity",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });

    const second = runCustomerServiceApi({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Personal Auto Standard",
      userTurnId: "u2",
      userCreatedAtIso: "2026-03-10T10:11:00Z",
    });

    expect(second).toEqual({
      sessionId: "E2E-003",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-product",
      responseId: "consult-product-resolved",
      responseText: "Product: Personal Auto Standard | SKU: AUTO-PERS-STD | Price: 128.50 USD | Availability: eligible | Summary: Personal Auto Standard is an entry-level personal auto coverage option for everyday drivers seeking basic liability and property damage protection.",
      stage: "resolve-product",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns canonical request-not-found response end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-004",
      businessContextId: "customer-service-core-v2",
      userMessageText: "What is the status of order ORDER-00000?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:12:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-004",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-order-status",
      responseId: "consult-order-status-resolved",
      responseText: "I could not find an order with the provided order ID. Please verify the order ID and try again.",
      stage: "resolve-order-status",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });

  it("returns rich broker eligibility end-to-end", () => {
    const result = runCustomerServiceApi({
      sessionId: "E2E-005",
      businessContextId: "customer-service-core-v2",
      userMessageText: "Is General Liability Core eligible?",
      userTurnId: "u1",
      userCreatedAtIso: "2026-03-10T10:13:00Z",
    });

    expect(result).toEqual({
      sessionId: "E2E-005",
      businessContextId: "customer-service-core-v2",
      resolvedIntentId: "consult-availability",
      responseId: "consult-availability-resolved",
      responseText: "Product: General Liability Core | Availability: broker-review | Eligibility: broker-review-required | Broker Review Required: true | Underwriting Review Required: false | Additional Documents Required: false | Notes: Broker review is required before this coverage option can be confirmed.",
      stage: "resolve-availability",
      status: "resolved",
      humanInterventionRequired: false,
      handoffReasonCode: undefined,
      handoffQueue: undefined,
    });
  });
});