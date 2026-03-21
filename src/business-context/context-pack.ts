export interface BusinessIntentDefinition {
  intentId: string;
  description: string;
  requiredEntities: string[];
  optionalEntities: string[];
  workflowId: string;
}

export interface BusinessEntityDefinition {
  entityId: string;
  entityType: "string" | "number" | "boolean" | "date" | "enum";
  required: boolean;
  allowedValues?: string[];
}

export interface BusinessWorkflowDefinition {
  workflowId: string;
  stages: string[];
  initialStage: string;
  terminalStages: string[];
}

export interface BusinessCanonicalResponseDefinition {
  responseId: string;
  intentId: string;
  stage: string;
  status: string;
  messageTemplate: string;
}

export interface BusinessHandoffRule {
  ruleId: string;
  whenIntentIds?: string[];
  whenStatuses?: string[];
  requiresHuman: boolean;
  queue?: string;
}

export interface BusinessTonePolicy {
  toneId: string;
  style: "formal" | "neutral" | "friendly";
  brevity: "short" | "medium" | "long";
}

export interface BusinessSessionPolicy {
  inactivityTimeoutMinutes: number;
  allowResume: boolean;
  maxTurnsBeforeClosure: number;
}

export interface BusinessContextPack {
  contextId: string;
  domain: string;
  businessName: string;
  supportedIntents: BusinessIntentDefinition[];
  entitySchema: BusinessEntityDefinition[];
  workflowRules: BusinessWorkflowDefinition[];
  canonicalResponses: BusinessCanonicalResponseDefinition[];
  handoffRules: BusinessHandoffRule[];
  tonePolicy: BusinessTonePolicy;
  sessionPolicy: BusinessSessionPolicy;
}