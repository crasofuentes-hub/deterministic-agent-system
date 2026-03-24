import type { DeterministicResponse } from "../core/contracts";
import type { AgentExecutionResult, DeterministicAgentPlan } from "../agent/plan-types";
import { executeDeterministicPlan } from "../agent/executor";
import { executeDeterministicPlanAsync } from "../agent/executor-async";
import type { AgentRunInput, Planner, AsyncPlanner } from "./types";

function hasPlanAsync(planner: Planner): planner is AsyncPlanner {
  return typeof (planner as AsyncPlanner).planAsync === "function";
}

async function resolvePlan(
  input: AgentRunInput,
  planner: Planner
): Promise<DeterministicAgentPlan> {
  if (hasPlanAsync(planner)) {
    return await planner.planAsync(input);
  }
  return planner.plan(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tryParseStateValue(value: string | undefined): unknown {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function projectDomainResult(
  execution: AgentExecutionResult | undefined
): AgentExecutionResult | undefined {
  if (!execution || !isRecord(execution)) {
    return execution;
  }

  const finalState = execution.finalState;
  if (!isRecord(finalState)) {
    return execution;
  }

  const values = finalState.values;
  if (!isRecord(values)) {
    return execution;
  }

  const priceLookup = tryParseStateValue(
    typeof values.priceLookup === "string" ? values.priceLookup : undefined
  ) as
    | { found?: boolean; productName?: string; price?: number | null; currency?: string | null }
    | undefined;

  const availabilityLookup = tryParseStateValue(
    typeof values.availabilityLookup === "string" ? values.availabilityLookup : undefined
  ) as
    | {
        found?: boolean;
        productName?: string;
        availability?: string | null;
        stockQuantity?: number | null;
      }
    | undefined;

  const productLookup = tryParseStateValue(
    typeof values.productLookup === "string" ? values.productLookup : undefined
  ) as
    | {
        found?: boolean;
        product?: null | {
          productId: string;
          sku: string;
          name: string;
          price: number;
          currency: string;
          availability: string;
          stockQuantity: number;
        };
      }
    | undefined;

  const orderLookup = tryParseStateValue(
    typeof values.orderLookup === "string" ? values.orderLookup : undefined
  ) as
    | {
        found?: boolean;
        order?: null | {
          orderId: string;
          status: string;
          customerName: string;
          items: string[];
          updatedAtIso: string;
        };
      }
    | undefined;

  const knowledgeLookup = tryParseStateValue(
    typeof values.knowledgeLookup === "string" ? values.knowledgeLookup : undefined
  ) as
    | {
        found?: boolean;
        record?: null | {
          topicId: string;
          productName: string;
          summary: string;
        };
      }
    | undefined;

  let domainResult: string | undefined;
  let canonicalResponse: string | undefined;

  if (priceLookup?.found && typeof priceLookup.productName === "string") {
    domainResult =
      "Product: " +
      priceLookup.productName +
      " | Price: " +
      Number(priceLookup.price).toFixed(2) +
      " " +
      String(priceLookup.currency ?? "");

    canonicalResponse =
      "The price of " +
      priceLookup.productName +
      " is " +
      Number(priceLookup.price).toFixed(2) +
      " " +
      String(priceLookup.currency ?? "") +
      ".";
  } else if (availabilityLookup?.found && typeof availabilityLookup.productName === "string") {
    domainResult =
      "Product: " +
      availabilityLookup.productName +
      " | Availability: " +
      String(availabilityLookup.availability ?? "") +
      " | Stock: " +
      String(availabilityLookup.stockQuantity ?? "");

    canonicalResponse =
      availabilityLookup.productName +
      " is currently " +
      String(availabilityLookup.availability ?? "") +
      " with stock " +
      String(availabilityLookup.stockQuantity ?? "") +
      ".";
  } else if (productLookup?.found && productLookup.product) {
    domainResult =
      "Product: " +
      productLookup.product.name +
      " | SKU: " +
      productLookup.product.sku +
      " | Price: " +
      Number(productLookup.product.price).toFixed(2) +
      " " +
      productLookup.product.currency +
      " | Availability: " +
      productLookup.product.availability;

    canonicalResponse =
      productLookup.product.name +
      " (" +
      productLookup.product.sku +
      ") costs " +
      Number(productLookup.product.price).toFixed(2) +
      " " +
      productLookup.product.currency +
      " and is currently " +
      productLookup.product.availability +
      ".";
  } else if (orderLookup?.found && orderLookup.order) {
    domainResult =
      "Order ID: " +
      orderLookup.order.orderId +
      " | Status: " +
      orderLookup.order.status +
      " | Updated: " +
      orderLookup.order.updatedAtIso;

    canonicalResponse =
      "Order " +
      orderLookup.order.orderId +
      " is currently " +
      orderLookup.order.status +
      " as of " +
      orderLookup.order.updatedAtIso +
      ".";
  } else if (knowledgeLookup?.found && knowledgeLookup.record) {
    domainResult =
      "Product: " +
      knowledgeLookup.record.productName +
      " | Summary: " +
      knowledgeLookup.record.summary;

    canonicalResponse = knowledgeLookup.record.productName + ": " + knowledgeLookup.record.summary;
  }

  if (!domainResult) {
    return execution;
  }

  return {
    ...execution,
    finalState: {
      ...execution.finalState,
      values: {
        ...execution.finalState.values,
        domainResult,
        ...(canonicalResponse ? { canonicalResponse } : {}),
      },
    },
  };
}

export async function runAgent(
  input: AgentRunInput,
  planner: Planner
): Promise<DeterministicResponse<AgentExecutionResult>> {
  const plan = await resolvePlan(input, planner);

  if (input.mode === "local") {
    const response = await executeDeterministicPlanAsync(plan, {
      mode: input.mode,
      maxSteps: input.maxSteps,
      traceId: input.traceId,
    });

    if (!response.ok || typeof response.result === "undefined") {
      return response;
    }

    return {
      ...response,
      result: projectDomainResult(response.result) ?? response.result,
    };
  }

  const response = executeDeterministicPlan(plan, {
    mode: input.mode,
    maxSteps: input.maxSteps,
    traceId: input.traceId,
  });

  if (!response.ok || typeof response.result === "undefined") {
    return response;
  }

  const projectedResult = projectDomainResult(response.result) ?? response.result;

  return {
    ...response,
    result: projectedResult,
    output: projectedResult,
  };
}
