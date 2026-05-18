import { describe, expect, it } from "vitest";
import {
  createRequestIdentity,
  requireRequestIdentity,
} from "../../src/core/request-identity";

describe("request identity", () => {
  it("creates deterministic authenticated request identity", () => {
    expect(
      createRequestIdentity({
        tenantId: "tenant-acme",
        subjectId: "api-key-main",
        scopes: ["journal:read", "agent:run", "agent:run"],
      }),
    ).toEqual({
      ok: true,
      value: {
        kind: "authenticated",
        source: "api-key",
        tenantId: "tenant-acme",
        subjectId: "api-key-main",
        scopes: ["agent:run", "journal:read"],
      },
    });
  });

  it("creates explicit local dev identity only when fallback is allowed", () => {
    expect(
      createRequestIdentity({
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

  it("rejects missing tenant id when fallback is not allowed", () => {
    expect(createRequestIdentity()).toEqual({
      ok: false,
      error: {
        code: "TENANT_ID_REQUIRED",
        message: "tenantId must be provided as a string",
      },
    });
  });

  it("rejects authenticated identity without subject id", () => {
    expect(
      createRequestIdentity({
        tenantId: "tenant-acme",
        scopes: ["agent:run"],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_REQUIRED",
        message: "subjectId must be provided as a string",
      },
    });
  });

  it("rejects authenticated identity without valid scopes", () => {
    expect(
      createRequestIdentity({
        tenantId: "tenant-acme",
        subjectId: "api-key-main",
        scopes: [],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "REQUEST_IDENTITY_SCOPES_INVALID",
        message: "scopes must contain at least one non-empty string",
      },
    });
  });

  it("throws deterministic errors when request identity is required", () => {
    expect(() =>
      requireRequestIdentity({
        tenantId: "tenant-acme",
        subjectId: "",
        scopes: ["agent:run"],
      }),
    ).toThrow("REQUEST_IDENTITY_SUBJECT_INVALID: subjectId must be a non-empty string");
  });
});