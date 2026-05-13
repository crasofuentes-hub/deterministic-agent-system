export type VerifiedPlannerStructuredEventName =
  | "llm_live.planner_prompt.received"
  | "llm_live.planner_prompt.verified"
  | "llm_live.planner_prompt.rejected"
  | "llm_live.planner_bridge.created_plan";

export interface VerifiedPlannerStructuredEvent {
  readonly event: VerifiedPlannerStructuredEventName;
  readonly traceId?: string;
  readonly planId?: string;
  readonly llmPlanTextFormat?: "planner-prompt-output";
  readonly promptContractId?: string;
  readonly promptContractVersion?: string;
  readonly toolNames?: readonly string[];
  readonly executable?: boolean;
  readonly errorCode?: string;
  readonly issueCount?: number;
  readonly stepCount?: number;
}

export function emitVerifiedPlannerStructuredEvent(event: VerifiedPlannerStructuredEvent): void {
  const line = {
    ts: new Date().toISOString(),
    subsystem: "llm-live",
    ...event,
  };

  process.stdout.write(JSON.stringify(line) + "\n");
}

export function normalizeVerifiedPlannerToolNames(
  tools: readonly { readonly name?: unknown }[],
): readonly string[] {
  return tools
    .map((tool) => tool.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim())
    .sort((left, right) => left.localeCompare(right));
}