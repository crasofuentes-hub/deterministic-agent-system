import { describe, expect, it } from "vitest";
import {
  normalizeCapabilityPipeline,
  validateCapabilityPipeline,
} from "../../src/agent-run/capability-preconditions";

describe("capability-preconditions", () => {
  it("keeps math isolated", () => {
    expect(normalizeCapabilityPipeline(["math.add"])).toEqual(["math.add"]);
    expect(validateCapabilityPipeline(["math.add"])).toEqual({ ok: true });
  });

  it("keeps echo isolated", () => {
    expect(normalizeCapabilityPipeline(["echo"])).toEqual(["echo"]);
    expect(validateCapabilityPipeline(["echo"])).toEqual({ ok: true });
  });

  it("inserts extract before select during normalization", () => {
    expect(normalizeCapabilityPipeline(["json.select"])).toEqual([
      "json.extract",
      "json.select",
    ]);
  });

  it("inserts extract and select before merge during normalization", () => {
    expect(normalizeCapabilityPipeline(["json.merge"])).toEqual([
      "json.extract",
      "json.select",
      "json.merge",
    ]);
  });

  it("validates normalized select pipeline", () => {
    expect(
      validateCapabilityPipeline(
        normalizeCapabilityPipeline(["json.select"])
      )
    ).toEqual({ ok: true });
  });

  it("validates normalized merge pipeline", () => {
    expect(
      validateCapabilityPipeline(
        normalizeCapabilityPipeline(["json.merge"])
      )
    ).toEqual({ ok: true });
  });

  it("rejects non-normalized merge pipeline missing select", () => {
    expect(
      validateCapabilityPipeline(["json.extract", "json.merge"])
    ).toEqual({
      ok: false,
      code: "MISSING_SELECT_PRECONDITION",
      message: "json.merge requires json.select in normalized pipeline",
    });
  });

  it("rejects non-normalized pipeline missing extract", () => {
    expect(
      validateCapabilityPipeline(["json.select"])
    ).toEqual({
      ok: false,
      code: "MISSING_EXTRACT_PRECONDITION",
      message: "json.select/json.merge require json.extract in normalized pipeline",
    });
  });
});