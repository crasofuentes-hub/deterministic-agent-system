import { describe, expect, it } from "vitest";
import {
  LOCAL_DEV_TENANT_ID,
  createTenantContext,
  normalizeTenantId,
  requireTenantContext,
} from "../../src/core/tenant-context";

describe("tenant context", () => {
  it("normalizes explicit tenant ids deterministically", () => {
    expect(normalizeTenantId(" acme-prod_01 ")).toEqual({
      ok: true,
      value: {
        tenantId: "acme-prod_01",
        source: "explicit",
      },
    });
  });

  it("rejects missing tenant ids by default", () => {
    expect(createTenantContext()).toEqual({
      ok: false,
      error: {
        code: "TENANT_ID_REQUIRED",
        message: "tenantId must be provided as a string",
      },
    });
  });

  it("allows local dev fallback only when explicitly requested", () => {
    expect(createTenantContext({ allowLocalDevFallback: true })).toEqual({
      ok: true,
      value: {
        tenantId: LOCAL_DEV_TENANT_ID,
        source: "local-dev-fallback",
      },
    });
  });

  it("rejects invalid tenant ids", () => {
    const result = normalizeTenantId("../bad tenant");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "TENANT_ID_INVALID",
        message:
          "tenantId must start with an alphanumeric character and may contain only alphanumeric characters, dot, underscore, colon, or hyphen; max length is 128",
      },
    });
  });

  it("throws deterministic errors when tenant context is required", () => {
    expect(() => requireTenantContext({})).toThrow(
      "TENANT_ID_REQUIRED: tenantId must be provided as a string",
    );
  });
});