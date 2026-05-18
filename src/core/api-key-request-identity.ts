import {
  createRequestIdentity,
  type RequestIdentity,
  type RequestIdentityError,
} from "./request-identity";

export interface ApiKeyCredential {
  readonly apiKey: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly scopes: readonly string[];
}

export interface ApiKeyRequestIdentityInput {
  readonly apiKey?: unknown;
  readonly credentials: readonly ApiKeyCredential[];
  readonly allowLocalDevFallback?: boolean;
}

export type ApiKeyRequestIdentityError =
  | RequestIdentityError
  | {
      readonly code:
        | "API_KEY_REQUIRED"
        | "API_KEY_INVALID"
        | "API_KEY_REGISTRY_INVALID";
      readonly message: string;
    };

export type ApiKeyRequestIdentityResult =
  | {
      readonly ok: true;
      readonly value: RequestIdentity;
    }
  | {
      readonly ok: false;
      readonly error: ApiKeyRequestIdentityError;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown, name: string): { ok: true; value: string } | { ok: false; error: ApiKeyRequestIdentityError } {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: name + " must be provided as a string",
      },
    };
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: name + " must be a non-empty string",
      },
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function normalizeInputApiKey(value: unknown): { ok: true; value: string } | { ok: false; error: ApiKeyRequestIdentityError } {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: {
        code: "API_KEY_REQUIRED",
        message: "apiKey must be provided as a string",
      },
    };
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REQUIRED",
        message: "apiKey must be a non-empty string",
      },
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function validateCredential(
  value: unknown,
  index: number,
): { ok: true; value: ApiKeyCredential } | { ok: false; error: ApiKeyRequestIdentityError } {
  if (!isObject(value)) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "api key credential at index " + index + " must be an object",
      },
    };
  }

  const apiKey = readNonEmptyString(value.apiKey, "apiKey");
  if (!apiKey.ok) return apiKey;

  const tenantId = readNonEmptyString(value.tenantId, "tenantId");
  if (!tenantId.ok) return tenantId;

  const subjectId = readNonEmptyString(value.subjectId, "subjectId");
  if (!subjectId.ok) return subjectId;

  if (!Array.isArray(value.scopes)) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "scopes must be an array of strings",
      },
    };
  }

  const scopes = value.scopes.map((scope) => (typeof scope === "string" ? scope.trim() : ""));

  if (scopes.length === 0 || scopes.some((scope) => scope.length === 0)) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "scopes must contain at least one non-empty string",
      },
    };
  }

  return {
    ok: true,
    value: {
      apiKey: apiKey.value,
      tenantId: tenantId.value,
      subjectId: subjectId.value,
      scopes: Array.from(new Set(scopes)).sort(),
    },
  };
}

function normalizeCredentials(
  credentials: readonly ApiKeyCredential[],
): { ok: true; value: readonly ApiKeyCredential[] } | { ok: false; error: ApiKeyRequestIdentityError } {
  if (!Array.isArray(credentials)) {
    return {
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "credentials must be an array",
      },
    };
  }

  const normalized: ApiKeyCredential[] = [];
  const seenApiKeys = new Set<string>();

  for (let index = 0; index < credentials.length; index += 1) {
    const credential = validateCredential(credentials[index], index);
    if (!credential.ok) return credential;

    if (seenApiKeys.has(credential.value.apiKey)) {
      return {
        ok: false,
        error: {
          code: "API_KEY_REGISTRY_INVALID",
          message: "duplicate apiKey in credential registry",
        },
      };
    }

    seenApiKeys.add(credential.value.apiKey);
    normalized.push(credential.value);
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function resolveApiKeyRequestIdentity(
  input: ApiKeyRequestIdentityInput,
): ApiKeyRequestIdentityResult {
  if (typeof input.apiKey === "undefined" && input.allowLocalDevFallback === true) {
    return createRequestIdentity({
      allowLocalDevFallback: true,
    });
  }

  const apiKey = normalizeInputApiKey(input.apiKey);
  if (!apiKey.ok) return apiKey;

  const credentials = normalizeCredentials(input.credentials);
  if (!credentials.ok) return credentials;

  const credential = credentials.value.find((item) => item.apiKey === apiKey.value);

  if (typeof credential === "undefined") {
    return {
      ok: false,
      error: {
        code: "API_KEY_INVALID",
        message: "apiKey is not recognized",
      },
    };
  }

  return createRequestIdentity({
    tenantId: credential.tenantId,
    subjectId: credential.subjectId,
    scopes: credential.scopes,
  });
}