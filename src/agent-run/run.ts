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

function projectDomainResult(execution: AgentExecutionResult): AgentExecutionResult {
  const values = execution.finalState.values;

  const priceLookup = tryParseStateValue(values.priceLookup) as
    | { found?: boolean; productName?: string; price?: number | null; currency?: string | null }
    | undefined;

  const availabilityLookup = tryParseStateValue(values.availabilityLookup) as
    | { found?: boolean; productName?: string; availability?: string | null; stockQuantity?: number | null }
    | undefined;

  const productLookup = tryParseStateValue(values.productLookup) as
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

  const orderLookup = tryParseStateValue(values.orderLookup) as
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

  const knowledgeLookup = tryParseStateValue(values.knowledgeLookup) as
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

  if (priceLookup?.found && typeof priceLookup.productName === "string") {
    domainResult =
      "Product: " +
      priceLookup.productName +
      " | Price: " +
      Number(priceLookup.price).toFixed(2) +
      " " +
      String(priceLookup.currency ?? "");
  } else if (availabilityLookup?.found && typeof availabilityLookup.productName === "string") {
    domainResult =
      "Product: " +
      availabilityLookup.productName +
      " | Availability: " +
      String(availabilityLookup.availability ?? "") +
      " | Stock: " +
      String(availabilityLookup.stockQuantity ?? "");
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
  } else if (orderLookup?.found && orderLookup.order) {
    domainResult =
      "Order ID: " +
      orderLookup.order.orderId +
      " | Status: " +
      orderLookup.order.status +
      " | Updated: " +
      orderLookup.order.updatedAtIso;
  } else if (knowledgeLookup?.found && knowledgeLookup.record) {
    domainResult =
      "Product: " +
      knowledgeLookup.record.productName +
      " | Summary: " +
      knowledgeLookup.record.summary;
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

    return {
      ...response,
      output: projectDomainResult(response.output),
    };
  }

  const response = executeDeterministicPlan(plan, {
    mode: input.mode,
    maxSteps: input.maxSteps,
    traceId: input.traceId,
  });

  return {
    ...response,
    output: projectDomainResult(response.output),
  };
}