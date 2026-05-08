import type { VersionedPromptContract } from "./contracts";

function readNonEmptyString(value: string, name: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(name + " must be a non-empty string");
  }

  return normalized;
}

export function buildPromptContractKey(id: string, version: string): string {
  return readNonEmptyString(id, "id") + "@" + readNonEmptyString(version, "version");
}

export class PromptRegistry {
  private readonly contracts = new Map<string, VersionedPromptContract>();

  register(contract: VersionedPromptContract): void {
    const key = buildPromptContractKey(contract.id, contract.version);

    if (this.contracts.has(key)) {
      throw new Error("Prompt contract already registered: " + key);
    }

    this.contracts.set(key, contract);
  }

  get<TOutput = unknown>(id: string, version: string): VersionedPromptContract<TOutput> {
    const key = buildPromptContractKey(id, version);
    const contract = this.contracts.get(key);

    if (!contract) {
      throw new Error("Prompt contract not found: " + key);
    }

    return contract as VersionedPromptContract<TOutput>;
  }

  list(): readonly VersionedPromptContract[] {
    return [...this.contracts.values()].sort((left, right) => {
      const leftKey = buildPromptContractKey(left.id, left.version);
      const rightKey = buildPromptContractKey(right.id, right.version);

      return leftKey.localeCompare(rightKey);
    });
  }
}

export function createPromptRegistry(
  contracts: readonly VersionedPromptContract[] = [],
): PromptRegistry {
  const registry = new PromptRegistry();

  for (const contract of contracts) {
    registry.register(contract);
  }

  return registry;
}