import { describe, expect, it } from "vitest";
import {
  assertRuntimeStorageMode,
  formatStorageModeStartupMessage,
  readRuntimeStorageModeEnvironment,
  resolveRuntimeStorageMode,
} from "../../src/storage";

describe("runtime storage mode resolver", () => {
  it("reads only supported storage-related environment fields", () => {
    expect(
      readRuntimeStorageModeEnvironment({
        NODE_ENV: "production",
        STORAGE_MODE: "postgres",
        DATABASE_URL: "postgres://localhost/app",
        SQLITE_PATH: ".local/app.sqlite",
        OTHER: "ignored",
      }),
    ).toEqual({
      NODE_ENV: "production",
      STORAGE_MODE: "postgres",
      DATABASE_URL: "postgres://localhost/app",
      SQLITE_PATH: ".local/app.sqlite",
    });
  });

  it("resolves runtime storage mode from explicit input env", () => {
    expect(
      resolveRuntimeStorageMode({
        env: {
          STORAGE_MODE: "memory",
        },
      }),
    ).toEqual({
      ok: true,
      mode: "memory",
      productionRecommended: false,
      reason: "memory storage is intended for tests and ephemeral local runs.",
    });
  });

  it("selects postgres for production auto mode when DATABASE_URL is configured", () => {
    expect(
      resolveRuntimeStorageMode({
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

  it("fails production auto mode clearly when DATABASE_URL is missing", () => {
    expect(
      resolveRuntimeStorageMode({
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

  it("assert helper throws deterministic startup errors", () => {
    expect(() =>
      assertRuntimeStorageMode({
        requestedMode: "postgres",
        env: {},
      }),
    ).toThrow(
      "POSTGRES_DATABASE_URL_REQUIRED: storage mode postgres requires DATABASE_URL or an explicit postgres connection URL.",
    );
  });

  it("formats startup messages for successful storage modes", () => {
    expect(
      formatStorageModeStartupMessage({
        ok: true,
        mode: "postgres",
        databaseUrl: "postgres://localhost/app",
        productionRecommended: true,
        reason: "postgres storage is recommended for production and live pilots.",
      }),
    ).toBe(
      'storage.mode mode=postgres productionRecommended=true reason="postgres storage is recommended for production and live pilots."',
    );

    expect(
      formatStorageModeStartupMessage({
        ok: true,
        mode: "sqlite",
        sqlitePath: ".data/app.sqlite",
        productionRecommended: false,
        reason: "auto storage selected sqlite for local zero-config usage.",
      }),
    ).toBe(
      'storage.mode mode=sqlite sqlitePath=".data/app.sqlite" productionRecommended=false reason="auto storage selected sqlite for local zero-config usage."',
    );
  });

  it("formats startup messages for storage mode errors", () => {
    expect(
      formatStorageModeStartupMessage({
        ok: false,
        code: "PRODUCTION_POSTGRES_REQUIRED",
        message:
          "storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production.",
        requestedMode: "auto",
        production: true,
        allowedModes: ["auto", "memory", "sqlite", "postgres"],
      }),
    ).toBe(
      'storage.mode.error code=PRODUCTION_POSTGRES_REQUIRED requestedMode=auto production=true message="storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production."',
    );
  });
});