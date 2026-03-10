import { describe, expect, it } from "vitest";
import { insertRequiredCapabilities } from "../../src/agent-run/capability-dependency-rules";

describe("capability-dependency-rules", () => {
  it("keeps extract pipeline unchanged", () => {
    expect(
      insertRequiredCapabilities(["json.extract"])
    ).toEqual({
      capabilities: ["json.extract"],
      inserted: [],
    });
  });

  it("inserts extract before select", () => {
    expect(
      insertRequiredCapabilities(["json.select"])
    ).toEqual({
      capabilities: ["json.extract", "json.select"],
      inserted: ["json.extract"],
    });
  });

  it("inserts extract and select before merge", () => {
    expect(
      insertRequiredCapabilities(["json.merge"])
    ).toEqual({
      capabilities: ["json.extract", "json.select", "json.merge"],
      inserted: ["json.extract", "json.select"],
    });
  });

  it("inserts select before merge when extract already exists", () => {
    expect(
      insertRequiredCapabilities(["json.extract", "json.merge"])
    ).toEqual({
      capabilities: ["json.extract", "json.select", "json.merge"],
      inserted: ["json.select"],
    });
  });

  it("preserves normalize before inserted dependencies", () => {
    expect(
      insertRequiredCapabilities(["text.normalize", "json.merge"])
    ).toEqual({
      capabilities: ["text.normalize", "json.extract", "json.select", "json.merge"],
      inserted: ["json.extract", "json.select"],
    });
  });

  it("keeps math isolated", () => {
    expect(
      insertRequiredCapabilities(["math.add"])
    ).toEqual({
      capabilities: ["math.add"],
      inserted: [],
    });
  });

  it("keeps echo isolated", () => {
    expect(
      insertRequiredCapabilities(["echo"])
    ).toEqual({
      capabilities: ["echo"],
      inserted: [],
    });
  });
});