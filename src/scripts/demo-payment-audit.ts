import { runCustomerServiceApi } from "../customer-service-api/customer-service-api";

interface DemoCase {
  name: string;
  input: {
    sessionId: string;
    businessContextId: string;
    userMessageText: string;
  };
}

function run(): void {
  const cases: DemoCase[] = [
    {
      name: "payment-status",
      input: {
        sessionId: "demo-payment-audit-001",
        businessContextId: "customer-service-payment-audit-v1",
        userMessageText: "What is the status of payment PMT-1001?",
      },
    },
    {
      name: "payment-history-policy",
      input: {
        sessionId: "demo-payment-audit-002",
        businessContextId: "customer-service-payment-audit-v1",
        userMessageText: "Show me the payment history for policy POL-900",
      },
    },
    {
      name: "policy-servicing",
      input: {
        sessionId: "demo-payment-audit-003",
        businessContextId: "customer-service-payment-audit-v1",
        userMessageText: "I need help with refund timing for policy POL-901",
      },
    },
    {
      name: "payment-discrepancy",
      input: {
        sessionId: "demo-payment-audit-004",
        businessContextId: "customer-service-payment-audit-v1",
        userMessageText: "I need help with a duplicate charge",
      },
    },
    {
      name: "payment-history-customer",
      input: {
        sessionId: "demo-payment-audit-005",
        businessContextId: "customer-service-payment-audit-v1",
        userMessageText: "Show me the payment history for customer CUS-101",
      },
    },
  ];

  for (const item of cases) {
    const result = runCustomerServiceApi(item.input);
    console.log("== " + item.name + " ==");
    console.log(JSON.stringify(result, null, 2));
  }
}

run();