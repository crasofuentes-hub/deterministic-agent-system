import { describe, expect, it } from "vitest";
import {
  resolveApiKeyRequestIdentity,
  type ApiKeyCredential,
} from "../../src/core/api-key-request-identity";

const credentials: readonly ApiKeyCredential[] = [
  {
    apiKey: "key-agent",
    tenantId: "tenant-acme",
    subjectId: "api-key-agent",
    scopes: ["agent:run", "journal:read", "agent:run"],
  },
  {
    apiKey: "key-replay",
    tenantId: "tenant-acme",
    subjectId: "api-key-replay",
    scopes: ["replay:read"],
  },
];

describe("api key request identity resolver", () => {
  it("resolves authenticated request identity from a configured api key", () => {
    expect(
      resolveApiKeyRequestIdentity({
        apiKey: "key-agent",
        credentials,
      }),
    ).toEqual({
      ok: true,
      value: {
        kind: "authenticated",
        source: "api-key",
        tenantId: "tenant-acme",
        subjectId: "api-key-agent",
        scopes: ["agent:run", "journal:read"],
      },
    });
  });

  it("trims input api key deterministically", () => {
    expect(
      resolveApiKeyRequestIdentity({
        apiKey: " key-replay ",
        credentials,
      }),
    ).toEqual({
      ok: true,
      value: {
        kind: "authenticated",
        source: "api-key",
        tenantId: "tenant-acme",
        subjectId: "api-key-replay",
        scopes: ["replay:read"],
      },
    });
  });

  it("returns local-dev identity only when fallback is explicitly allowed and api key is absent", () => {
    expect(
      resolveApiKeyRequestIdentity({
        credentials,
        allowLocalDevFallback: true,
      }),
    ).toEqual({
      ok: true,
      value: {
        kind: "local-dev",
        source: "local-dev-fallback",
        tenantId: "local-dev",
        subjectId: "local-dev",
        scopes: ["*"],
      },
    });
  });

  it("rejects missing api key when fallback is not allowed", () => {
    expect(
      resolveApiKeyRequestIdentity({
        credentials,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "API_KEY_REQUIRED",
        message: "apiKey must be provided as a string",
      },
    });
  });

  it("rejects unknown api keys deterministically", () => {
    expect(
      resolveApiKeyRequestIdentity({
        apiKey: "unknown",
        credentials,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "API_KEY_INVALID",
        message: "apiKey is not recognized",
      },
    });
  });

  it("rejects duplicate api keys in the configured registry", () => {
    expect(
      resolveApiKeyRequestIdentity({
        apiKey: "key-agent",
        credentials: [
          credentials[0],
          {
            ...credentials[0],
            subjectId: "api-key-agent-duplicate",
          },
        ],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "duplicate apiKey in credential registry",
      },
    });
  });

  it("rejects invalid credential scopes before creating identity", () => {
    expect(
      resolveApiKeyRequestIdentity({
        apiKey: "key-invalid",
        credentials: [
          {
            apiKey: "key-invalid",
            tenantId: "tenant-acme",
            subjectId: "api-key-invalid",
            scopes: [],
          },
        ],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "API_KEY_REGISTRY_INVALID",
        message: "scopes must contain at least one non-empty string",
      },
    });
  });
});