import { describe, expect, it } from "vitest";
import {
  normalizeCapabilityPipeline,
  validateCapabilityPipeline,
} from "../../src/agent-run/capability-preconditions";

describe("capability-policy-boundaries", () => {
  it("autocorrects json.select into canonical json pipeline", () => {
    const normalized = normalizeCapabilityPipeline(["json.select"]);

    expect(normalized).toEqual([
      "json.extract",
      "json.select",
    ]);

    expect(validateCapabilityPipeline(normalized)).toEqual({ ok: true });
  });

  it("autocorrects json.merge into canonical json pipeline", () => {
    const normalized = normalizeCapabilityPipeline(["json.merge"]);

    expect(normalized).toEqual([
      "json.extract",
      "json.select",
      "json.merge",
    ]);

    expect(validateCapabilityPipeline(normalized)).toEqual({ ok: true });
  });

  it("rejects math mixed with json family", () => {
    expect(
      validateCapabilityPipeline(["math.add", "json.extract"])
    ).toEqual({
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "math.add cannot be combined with other capabilities",
    });
  });

  it("rejects echo mixed with json family", () => {
    expect(
      validateCapabilityPipeline(["echo", "json.extract"])
    ).toEqual({
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "echo cannot be combined with other capabilities",
    });
  });

  it("rejects math mixed with normalize family", () => {
    expect(
      validateCapabilityPipeline(["math.add", "text.normalize"])
    ).toEqual({
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "math.add cannot be combined with other capabilities",
    });
  });

  it("rejects echo mixed with normalize family", () => {
    expect(
      validateCapabilityPipeline(["echo", "text.normalize"])
    ).toEqual({
      ok: false,
      code: "INVALID_CAPABILITY_COMBINATION",
      message: "echo cannot be combined with other capabilities",
    });
  });
});