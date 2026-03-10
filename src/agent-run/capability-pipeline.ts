import type { DeterministicAgentPlan, AgentStep } from "../agent/plan-types";
import type { ToolCapability } from "../agent/tools";
import { resolveToolIdForCapability } from "../agent/tools";
import { normalizeCapabilityPipeline, validateCapabilityPipeline } from "./capability-preconditions";
import {
  bindStepInputRef,
  validateRequiredDerivedInputs,
  validateStepDependencies
} from "./step-dependencies";

function makeBaseSteps(goal: string, intent: string, plannedLog: string): AgentStep[] {
  return [
    { id: "a", kind: "set", key: "goal", value: goal },
    { id: "b", kind: "set", key: "intent", value: intent },
    { id: "c", kind: "append_log", value: plannedLog },
  ];
}

function buildPlanId(plannerPrefix: string, intent: string): string {
  if (plannerPrefix === "llm-live") {
    return "agent-run-llm-live-mock-v1:" + intent;
  }

  if (plannerPrefix === "llm-mock") {
    return "agent-run-llm-mock-v1:" + intent;
  }

  return "agent-run-" + plannerPrefix + "-v1:" + intent;
}

function validateCanonicalDerivedInputs(steps: AgentStep[]): void {
  const derivedValidation = validateRequiredDerivedInputs(steps, [
    {
      consumerToolId: resolveToolIdForCapability("json.extract"),
      inputKey: "text",
      producerOutputKey: "normalizedJson",
      nestedPath: "text",
    },
    {
      consumerToolId: resolveToolIdForCapability("json.select"),
      inputKey: "text",
      producerOutputKey: "extractedUser",
      nestedPath: "value",
    },
    {
      consumerToolId: resolveToolIdForCapability("json.merge"),
      inputKey: "left",
      producerOutputKey: "selected",
      nestedPath: "value",
    },
  ]);

  if (!derivedValidation.ok) {
    throw new Error(derivedValidation.code + ": " + derivedValidation.message);
  }
}

export function buildCapabilitySynthPlan(params: {
  plannerPrefix: string;
  goal: string;
  intent: string;
  capabilities: ToolCapability[];
}): DeterministicAgentPlan {
  const { plannerPrefix, goal, intent, capabilities } = params;
  const caps = normalizeCapabilityPipeline(capabilities);
  const validation = validateCapabilityPipeline(caps);

  if (!validation.ok) {
    throw new Error(validation.code + ": " + validation.message);
  }

  const plannedLog = plannerPrefix === "llm-live" ? "llm-live:planned" : "llm-mock:plan";
  const steps: AgentStep[] = [...makeBaseSteps(goal, intent, plannedLog)];

  const hasNormalize = caps.includes("text.normalize");
  const hasExtract = caps.includes("json.extract");
  const hasSelect = caps.includes("json.select");
  const hasMerge = caps.includes("json.merge");
  const hasMath = caps.includes("math.add");
  const hasEchoOnly = caps.length === 1 && caps[0] === "echo";

  let nextIdCode = "d".charCodeAt(0);
  function nextId(): string {
    const out = String.fromCharCode(nextIdCode);
    nextIdCode += 1;
    return out;
  }

  if (hasMath) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("math.add"),
      input: { a: 2, b: 3 },
      outputKey: "sum"
    });
    steps.push({ id: nextId(), kind: "append_log", value: "done" });

    const dependencyValidation = validateStepDependencies(steps);
    if (!dependencyValidation.ok) {
      throw new Error(dependencyValidation.code + ": " + dependencyValidation.message);
    }

    validateCanonicalDerivedInputs(steps);

    return {
      planId: buildPlanId(plannerPrefix, intent),
      version: 1,
      steps,
    };
  }

  if (hasEchoOnly) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("echo"),
      input: { value: plannerPrefix + ":" + intent },
      outputKey: "output"
    });
    steps.push({ id: nextId(), kind: "append_log", value: "done" });

    const dependencyValidation = validateStepDependencies(steps);
    if (!dependencyValidation.ok) {
      throw new Error(dependencyValidation.code + ": " + dependencyValidation.message);
    }

    validateCanonicalDerivedInputs(steps);

    return {
      planId: buildPlanId(plannerPrefix, intent),
      version: 1,
      steps,
    };
  }

  const rawJson = '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } , "meta" : { "ok" : true } }  ';
  let currentTextRef: unknown = rawJson;
  let currentObjectRef: unknown = undefined;

  if (hasNormalize) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("text.normalize"),
      input: {
        text: rawJson,
        trim: true,
        lowercase: false,
        collapseWhitespace: true
      },
      outputKey: "normalizedJson"
    });

    currentTextRef = bindStepInputRef({
      steps,
      outputKey: "normalizedJson",
      nestedPath: "text",
      fallbackValue: rawJson,
    });
  }

  if (hasExtract) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("json.extract"),
      input: {
        text: currentTextRef,
        path: "user"
      },
      outputKey: "extractedUser"
    });

    currentObjectRef = bindStepInputRef({
      steps,
      outputKey: "extractedUser",
      nestedPath: "value",
      fallbackValue: undefined,
    });
  }

  if (hasSelect) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("json.select"),
      input: {
        text: currentObjectRef,
        keys: ["name", "role"]
      },
      outputKey: "selected"
    });

    currentObjectRef = bindStepInputRef({
      steps,
      outputKey: "selected",
      nestedPath: "value",
      fallbackValue: undefined,
    });
  }

  if (hasMerge) {
    steps.push({
      id: nextId(),
      kind: "tool.call",
      toolId: resolveToolIdForCapability("json.merge"),
      input: {
        left: currentObjectRef,
        right: JSON.stringify({ source: plannerPrefix, workflow: intent })
      },
      outputKey: "merged"
    });
  }

  steps.push({ id: nextId(), kind: "append_log", value: "done" });

  const dependencyValidation = validateStepDependencies(steps);
  if (!dependencyValidation.ok) {
    throw new Error(dependencyValidation.code + ": " + dependencyValidation.message);
  }

  validateCanonicalDerivedInputs(steps);

  return {
    planId: buildPlanId(plannerPrefix, intent),
    version: 1,
    steps,
  };
}