export const LOCAL_DEV_TENANT_ID = "local-dev";

export type TenantContextSource = "explicit" | "local-dev-fallback";

export interface TenantContext {
  readonly tenantId: string;
  readonly source: TenantContextSource;
}

export interface TenantContextInput {
  readonly tenantId?: unknown;
  readonly allowLocalDevFallback?: boolean;
}

export type TenantContextResult =
  | {
      readonly ok: true;
      readonly value: TenantContext;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: "TENANT_ID_REQUIRED" | "TENANT_ID_INVALID";
        readonly message: string;
      };
    };

const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function normalizeTenantId(value: unknown): TenantContextResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: {
        code: "TENANT_ID_REQUIRED",
        message: "tenantId must be provided as a string",
      },
    };
  }

  const tenantId = value.trim();

  if (tenantId.length === 0) {
    return {
      ok: false,
      error: {
        code: "TENANT_ID_REQUIRED",
        message: "tenantId must be a non-empty string",
      },
    };
  }

  if (!TENANT_ID_PATTERN.test(tenantId)) {
    return {
      ok: false,
      error: {
        code: "TENANT_ID_INVALID",
        message:
          "tenantId must start with an alphanumeric character and may contain only alphanumeric characters, dot, underscore, colon, or hyphen; max length is 128",
      },
    };
  }

  return {
    ok: true,
    value: {
      tenantId,
      source: "explicit",
    },
  };
}

export function createTenantContext(input: TenantContextInput = {}): TenantContextResult {
  const normalized = normalizeTenantId(input.tenantId);

  if (normalized.ok) {
    return normalized;
  }

  if (
    normalized.error.code === "TENANT_ID_REQUIRED" &&
    input.allowLocalDevFallback === true
  ) {
    return {
      ok: true,
      value: {
        tenantId: LOCAL_DEV_TENANT_ID,
        source: "local-dev-fallback",
      },
    };
  }

  return normalized;
}

export function requireTenantContext(input: TenantContextInput): TenantContext {
  const result = createTenantContext(input);

  if (!result.ok) {
    throw new Error(result.error.code + ": " + result.error.message);
  }

  return result.value;
}