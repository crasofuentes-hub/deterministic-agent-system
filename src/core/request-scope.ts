import type { RequestIdentity } from "./request-identity";

export interface RequestScopeCheckInput {
  readonly identity: RequestIdentity;
  readonly requiredScope: string;
}

export type RequestScopeCheckResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: "REQUEST_SCOPE_DENIED";
        readonly message: string;
        readonly requiredScope: string;
        readonly subjectId: string;
        readonly tenantId: string;
      };
    };

function normalizeRequiredScope(value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error("requiredScope must be a non-empty string");
  }

  return normalized;
}

export function hasRequestScope(
  identity: RequestIdentity,
  requiredScope: string,
): boolean {
  const normalizedRequiredScope = normalizeRequiredScope(requiredScope);

  const scopes: readonly string[] = identity.scopes;

  return scopes.includes("*") || scopes.includes(normalizedRequiredScope);
}

export function checkRequestScope(
  input: RequestScopeCheckInput,
): RequestScopeCheckResult {
  const requiredScope = normalizeRequiredScope(input.requiredScope);

  if (hasRequestScope(input.identity, requiredScope)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: {
      code: "REQUEST_SCOPE_DENIED",
      message: "Request identity does not have the required scope",
      requiredScope,
      subjectId: input.identity.subjectId,
      tenantId: input.identity.tenantId,
    },
  };
}

export function requireRequestScope(input: RequestScopeCheckInput): void {
  const result = checkRequestScope(input);

  if (!result.ok) {
    throw new Error(
      result.error.code +
        ": " +
        result.error.message +
        ": " +
        result.error.requiredScope,
    );
  }
}