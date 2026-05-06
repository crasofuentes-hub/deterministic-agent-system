export type DomainExtensionCapabilityKind =
  | "query"
  | "workflow"
  | "model"
  | "integration";

export interface DomainExtensionCapability {
  readonly id: string;
  readonly kind: DomainExtensionCapabilityKind;
  readonly description: string;
}

export interface DomainExtension {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly capabilities: readonly DomainExtensionCapability[];
}