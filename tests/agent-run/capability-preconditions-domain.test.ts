import { describe, expect, it } from "vitest";
import { normalizeCapabilityPipelineDetailed } from "../../src/agent-run/capability-preconditions";

describe("capability preconditions domain", () => {
  it("preserves catalog.price-find", () => {
    expect(
      normalizeCapabilityPipelineDetailed(["catalog.price-find"])
    ).toEqual({
      capabilities: ["catalog.price-find"],
      inserted: [],
    });
  });

  it("preserves catalog.availability-find", () => {
    expect(
      normalizeCapabilityPipelineDetailed(["catalog.availability-find"])
    ).toEqual({
      capabilities: ["catalog.availability-find"],
      inserted: [],
    });
  });

  it("preserves orders.find-by-id", () => {
    expect(
      normalizeCapabilityPipelineDetailed(["orders.find-by-id"])
    ).toEqual({
      capabilities: ["orders.find-by-id"],
      inserted: [],
    });
  });

  it("preserves kb.find-by-product-name", () => {
    expect(
      normalizeCapabilityPipelineDetailed(["kb.find-by-product-name"])
    ).toEqual({
      capabilities: ["kb.find-by-product-name"],
      inserted: [],
    });
  });
});