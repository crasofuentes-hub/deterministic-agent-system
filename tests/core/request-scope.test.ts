import { describe, expect, it } from "vitest";
import type { RequestIdentity } from "../../src/core/request-identity";
import {
  checkRequestScope,
  hasRequestScope,
  requireRequestScope,
} from "../../src/core/request-scope";

function authenticatedIdentity(scopes: readonly string[]): RequestIdentity {
  return {
    kind: "authenticated",
    source: "api-key",
    tenantId: "tenant-acme",
    subjectId: "api-key-main",
    scopes,
  };
}

describe("request scope guard", () => {
  it("accepts identity with required explicit scope", () => {
    const identity = authenticatedIdentity(["agent:run", "journal:read"]);

    expect(hasRequestScope(identity, "agent:run")).toBe(true);

    expect(
      checkRequestScope({
        identity,
        requiredScope: "agent:run",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts wildcard local-dev scope", () => {
    const identity: RequestIdentity = {
      kind: "local-dev",
      source: "local-dev-fallback",
      tenantId: "local-dev",
      subjectId: "local-dev",
      scopes: ["*"],
    };

    expect(hasRequestScope(identity, "replay:read")).toBe(true);

    expect(
      checkRequestScope({
        identity,
        requiredScope: "replay:read",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects identity without required scope", () => {
    const identity = authenticatedIdentity(["journal:read"]);

    expect(hasRequestScope(identity, "agent:run")).toBe(false);

    expect(
      checkRequestScope({
        identity,
        requiredScope: "agent:run",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "REQUEST_SCOPE_DENIED",
        message: "Request identity does not have the required scope",
        requiredScope: "agent:run",
        subjectId: "api-key-main",
        tenantId: "tenant-acme",
      },
    });
  });

  it("normalizes required scope whitespace", () => {
    const identity = authenticatedIdentity(["agent:run"]);

    expect(
      checkRequestScope({
        identity,
        requiredScope: " agent:run ",
      }),
    ).toEqual({ ok: true });
  });

  it("throws deterministic error for empty required scope", () => {
    const identity = authenticatedIdentity(["agent:run"]);

    expect(() =>
      checkRequestScope({
        identity,
        requiredScope: "",
      }),
    ).toThrow("requiredScope must be a non-empty string");
  });

  it("throws deterministic authorization errors when scope is required", () => {
    const identity = authenticatedIdentity(["journal:read"]);

    expect(() =>
      requireRequestScope({
        identity,
        requiredScope: "agent:run",
      }),
    ).toThrow(
      "REQUEST_SCOPE_DENIED: Request identity does not have the required scope: agent:run",
    );
  });
});