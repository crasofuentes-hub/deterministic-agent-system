import { describe, expect, it } from "vitest";
import {
  DEFAULT_SQLITE_PATH,
  assertResolvedStorageMode,
  isProductionEnvironment,
  parseStorageMode,
  resolveStorageMode,
} from "../../src/storage";

describe("global storage mode strategy", () => {
  it("parses supported storage modes deterministically", () => {
    expect(parseStorageMode(undefined)).toBe("auto");
    expect(parseStorageMode("")).toBe("auto");
    expect(parseStorageMode(" AUTO ")).toBe("auto");
    expect(parseStorageMode("memory")).toBe("memory");
    expect(parseStorageMode("sqlite")).toBe("sqlite");
    expect(parseStorageMode("postgres")).toBe("postgres");
  });

  it("rejects unsupported storage modes with a useful error", () => {
    expect(() => parseStorageMode("redis")).toThrow(
      "Invalid storage mode: redis. Allowed modes: auto, memory, sqlite, postgres",
    );
  });

  it("detects production environment deterministically", () => {
    expect(isProductionEnvironment({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: " Production " })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionEnvironment({})).toBe(false);
  });

  it("resolves memory mode for tests and ephemeral local runs", () => {
    expect(resolveStorageMode({ requestedMode: "memory" })).toEqual({
      ok: true,
      mode: "memory",
      productionRecommended: false,
      reason: "memory storage is intended for tests and ephemeral local runs.",
    });
  });

  it("resolves sqlite mode with default zero-config path", () => {
    expect(resolveStorageMode({ requestedMode: "sqlite" })).toEqual({
      ok: true,
      mode: "sqlite",
      sqlitePath: DEFAULT_SQLITE_PATH,
      productionRecommended: false,
      reason: "sqlite storage is intended for local development and zero-config usage.",
    });
  });

  it("resolves sqlite mode with explicit env path", () => {
    expect(
      resolveStorageMode({
        requestedMode: "sqlite",
        env: {
          SQLITE_PATH: ".local/app.sqlite",
        },
      }),
    ).toMatchObject({
      ok: true,
      mode: "sqlite",
      sqlitePath: ".local/app.sqlite",
    });
  });

  it("resolves explicit postgres only when database url is configured", () => {
    expect(
      resolveStorageMode({
        requestedMode: "postgres",
        env: {
          DATABASE_URL: "postgres://user:pass@localhost:5432/app",
        },
      }),
    ).toEqual({
      ok: true,
      mode: "postgres",
      databaseUrl: "postgres://user:pass@localhost:5432/app",
      productionRecommended: true,
      reason: "postgres storage is recommended for production and live pilots.",
    });

    expect(resolveStorageMode({ requestedMode: "postgres" })).toEqual({
      ok: false,
      code: "POSTGRES_DATABASE_URL_REQUIRED",
      message:
        "storage mode postgres requires DATABASE_URL or an explicit postgres connection URL.",
      requestedMode: "postgres",
      production: false,
      allowedModes: ["auto", "memory", "sqlite", "postgres"],
    });
  });

  it("keeps auto mode local-friendly by selecting sqlite outside production", () => {
    expect(resolveStorageMode({ requestedMode: "auto" })).toEqual({
      ok: true,
      mode: "sqlite",
      sqlitePath: DEFAULT_SQLITE_PATH,
      productionRecommended: false,
      reason: "auto storage selected sqlite for local zero-config usage.",
    });
  });

  it("selects postgres in production auto mode when DATABASE_URL is configured", () => {
    expect(
      resolveStorageMode({
        requestedMode: "auto",
        env: {
          NODE_ENV: "production",
          DATABASE_URL: "postgres://user:pass@localhost:5432/app",
        },
      }),
    ).toEqual({
      ok: true,
      mode: "postgres",
      databaseUrl: "postgres://user:pass@localhost:5432/app",
      productionRecommended: true,
      reason:
        "auto storage detected production and selected postgres because DATABASE_URL is configured.",
    });
  });

  it("fails production auto mode clearly when postgres is not configured", () => {
    expect(
      resolveStorageMode({
        requestedMode: "auto",
        env: {
          NODE_ENV: "production",
        },
      }),
    ).toEqual({
      ok: false,
      code: "PRODUCTION_POSTGRES_REQUIRED",
      message:
        "storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production.",
      requestedMode: "auto",
      production: true,
      allowedModes: ["auto", "memory", "sqlite", "postgres"],
    });
  });

  it("uses STORAGE_MODE from env when requested mode is omitted", () => {
    expect(
      resolveStorageMode({
        env: {
          STORAGE_MODE: "memory",
        },
      }),
    ).toMatchObject({
      ok: true,
      mode: "memory",
    });
  });

  it("assert helper returns resolved mode or throws deterministic error", () => {
    expect(
      assertResolvedStorageMode({
        requestedMode: "sqlite",
      }),
    ).toMatchObject({
      mode: "sqlite",
    });

    expect(() =>
      assertResolvedStorageMode({
        requestedMode: "postgres",
      }),
    ).toThrow(
      "POSTGRES_DATABASE_URL_REQUIRED: storage mode postgres requires DATABASE_URL or an explicit postgres connection URL.",
    );
  });
});