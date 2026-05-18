import { LOCAL_DEV_TENANT_ID, createTenantContext } from "./tenant-context";

export type RequestIdentityKind = "authenticated" | "local-dev";
export type RequestIdentitySource = "api-key" | "local-dev-fallback";

export interface AuthenticatedRequestIdentity {
  readonly kind: "authenticated";
  readonly source: "api-key";
  readonly tenantId: string;
  readonly subjectId: string;
  readonly scopes: readonly string[];
}

export interface LocalDevRequestIdentity {
  readonly kind: "local-dev";
  readonly source: "local-dev-fallback";
  readonly tenantId: typeof LOCAL_DEV_TENANT_ID;
  readonly subjectId: "local-dev";
  readonly scopes: readonly ["*"];
}

export type RequestIdentity = AuthenticatedRequestIdentity | LocalDevRequestIdentity;

export interface RequestIdentityInput {
  readonly tenantId?: unknown;
  readonly subjectId?: unknown;
  readonly scopes?: unknown;
  readonly allowLocalDevFallback?: boolean;
}

export interface RequestIdentityError {
  readonly code:
    | "REQUEST_IDENTITY_REQUIRED"
    | "REQUEST_IDENTITY_SUBJECT_INVALID"
    | "REQUEST_IDENTITY_SCOPES_INVALID"
    | "TENANT_ID_REQUIRED"
    | "TENANT_ID_INVALID";
  readonly message: string;
}

export type RequestIdentityResult =
  | {
      readonly ok: true;
      readonly value: RequestIdentity;
    }
  | {
      readonly ok: false;
      readonly error: RequestIdentityError;
    };

type SubjectIdResult =
  | {
      readonly ok: true;
      readonly value: string;
    }
  | {
      readonly ok: false;
      readonly error: RequestIdentityError;
    };

type ScopesResult =
  | {
      readonly ok: true;
      readonly value: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: RequestIdentityError;
    };

function normalizeSubjectId(value: unknown): SubjectIdResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_REQUIRED",
        message: "subjectId must be provided as a string",
      },
    };
  }

  const subjectId = value.trim();

  if (subjectId.length === 0) {
    return {
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_SUBJECT_INVALID",
        message: "subjectId must be a non-empty string",
      },
    };
  }

  if (subjectId.length > 128) {
    return {
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_SUBJECT_INVALID",
        message: "subjectId must be at most 128 characters",
      },
    };
  }

  return {
    ok: true,
    value: subjectId,
  };
}

function normalizeScopes(value: unknown): ScopesResult {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_SCOPES_INVALID",
        message: "scopes must be an array of non-empty strings",
      },
    };
  }

  const scopes = value.map((item) => (typeof item === "string" ? item.trim() : ""));

  if (scopes.length === 0 || scopes.some((scope) => scope.length === 0)) {
    return {
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_SCOPES_INVALID",
        message: "scopes must contain at least one non-empty string",
      },
    };
  }

  return {
    ok: true,
    value: Array.from(new Set(scopes)).sort(),
  };
}

export function createRequestIdentity(input: RequestIdentityInput = {}): RequestIdentityResult {
  const tenantContext = createTenantContext({
    tenantId: input.tenantId,
    allowLocalDevFallback: input.allowLocalDevFallback,
  });

  if (!tenantContext.ok) {
    return {
      ok: false,
      error: tenantContext.error,
    };
  }

  if (tenantContext.value.source === "local-dev-fallback") {
    return {
      ok: true,
      value: {
        kind: "local-dev",
        source: "local-dev-fallback",
        tenantId: LOCAL_DEV_TENANT_ID,
        subjectId: "local-dev",
        scopes: ["*"],
      },
    };
  }

  const subjectId = normalizeSubjectId(input.subjectId);
  if (!subjectId.ok) {
    return subjectId;
  }

  const scopes = normalizeScopes(input.scopes);
  if (!scopes.ok) {
    return scopes;
  }

  return {
    ok: true,
    value: {
      kind: "authenticated",
      source: "api-key",
      tenantId: tenantContext.value.tenantId,
      subjectId: subjectId.value,
      scopes: scopes.value,
    },
  };
}

export function requireRequestIdentity(input: RequestIdentityInput): RequestIdentity {
  const result = createRequestIdentity(input);

  if (!result.ok) {
    throw new Error(result.error.code + ": " + result.error.message);
  }

  return result.value;
}