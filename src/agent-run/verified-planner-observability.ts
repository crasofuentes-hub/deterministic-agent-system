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

export interface VerifiedPlannerStructuredEventEnvelope extends VerifiedPlannerStructuredEvent {
  readonly ts: string;
  readonly subsystem: "llm-live";
}

export type VerifiedPlannerStructuredEventSink = (
  event: VerifiedPlannerStructuredEventEnvelope,
) => void;

interface VerifiedPlannerStructuredEventRegistry {
  sink?: VerifiedPlannerStructuredEventSink;
}

const VERIFIED_PLANNER_STRUCTURED_EVENT_REGISTRY_KEY = Symbol.for(
  "deterministic-agent-system.verified-planner-structured-event-registry",
);

function getVerifiedPlannerStructuredEventRegistry(): VerifiedPlannerStructuredEventRegistry {
  const globalWithRegistry = globalThis as typeof globalThis & {
    [VERIFIED_PLANNER_STRUCTURED_EVENT_REGISTRY_KEY]?: VerifiedPlannerStructuredEventRegistry;
  };

  if (!globalWithRegistry[VERIFIED_PLANNER_STRUCTURED_EVENT_REGISTRY_KEY]) {
    globalWithRegistry[VERIFIED_PLANNER_STRUCTURED_EVENT_REGISTRY_KEY] = {};
  }

  return globalWithRegistry[VERIFIED_PLANNER_STRUCTURED_EVENT_REGISTRY_KEY];
}

export function setVerifiedPlannerStructuredEventSink(
  sink: VerifiedPlannerStructuredEventSink | undefined,
): () => void {
  const registry = getVerifiedPlannerStructuredEventRegistry();
  const previous = registry.sink;

  registry.sink = sink;

  return () => {
    registry.sink = previous;
  };
}

export function clearVerifiedPlannerStructuredEventSink(): void {
  delete getVerifiedPlannerStructuredEventRegistry().sink;
}

function emitSinkFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      subsystem: "llm-live",
      event: "llm_live.planner_event_sink.error",
      error: message,
    }) + "\n",
  );
}

export function emitVerifiedPlannerStructuredEvent(event: VerifiedPlannerStructuredEvent): void {
  const envelope: VerifiedPlannerStructuredEventEnvelope = {
    ts: new Date().toISOString(),
    subsystem: "llm-live",
    ...event,
  };

  process.stdout.write(JSON.stringify(envelope) + "\n");

  const sink = getVerifiedPlannerStructuredEventRegistry().sink;

  if (typeof sink === "undefined") {
    return;
  }

  try {
    sink(envelope);
  } catch (error) {
    emitSinkFailure(error);
  }
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