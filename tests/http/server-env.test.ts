import { describe, expect, it } from "vitest";
import { resolveServeEnv } from "../../src/http/server-env";

describe("server env resolver", () => {
  it("keeps local serve defaults deterministic", () => {
    expect(resolveServeEnv({})).toEqual({
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("reads HOST and PORT from explicit environment", () => {
    expect(
      resolveServeEnv({
        HOST: " 0.0.0.0 ",
        PORT: " 8080 ",
      }),
    ).toEqual({
      host: "0.0.0.0",
      port: 8080,
    });
  });

  it("rejects invalid ports deterministically", () => {
    expect(() => resolveServeEnv({ PORT: "abc" })).toThrow(
      "PORT must be a TCP port between 1 and 65535",
    );

    expect(() => resolveServeEnv({ PORT: "0" })).toThrow(
      "PORT must be a TCP port between 1 and 65535",
    );

    expect(() => resolveServeEnv({ PORT: "65536" })).toThrow(
      "PORT must be a TCP port between 1 and 65535",
    );
  });
});