import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitHttpStorageModeStartupStatus,
  resolveHttpStorageModeStartupStatus,
} from "../../src/http/storage-mode-startup";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("http storage mode startup status", () => {
  it("resolves local auto mode as sqlite startup status", () => {
    expect(resolveHttpStorageModeStartupStatus({ env: {} })).toEqual({
      resolution: {
        ok: true,
        mode: "sqlite",
        sqlitePath: ".data/deterministic-agent-system.sqlite",
        productionRecommended: false,
        reason: "auto storage selected sqlite for local zero-config usage.",
      },
      message:
        'storage.mode mode=sqlite sqlitePath=".data/deterministic-agent-system.sqlite" productionRecommended=false reason="auto storage selected sqlite for local zero-config usage."',
    });
  });

  it("resolves production auto mode as postgres when DATABASE_URL exists", () => {
    expect(
      resolveHttpStorageModeStartupStatus({
        env: {
          NODE_ENV: "production",
          DATABASE_URL: "postgres://localhost/app",
        },
      }),
    ).toEqual({
      resolution: {
        ok: true,
        mode: "postgres",
        databaseUrl: "postgres://localhost/app",
        productionRecommended: true,
        reason:
          "auto storage detected production and selected postgres because DATABASE_URL is configured.",
      },
      message:
        'storage.mode mode=postgres productionRecommended=true reason="auto storage detected production and selected postgres because DATABASE_URL is configured."',
    });
  });

  it("resolves production auto mode error when DATABASE_URL is missing", () => {
    expect(
      resolveHttpStorageModeStartupStatus({
        env: {
          NODE_ENV: "production",
        },
      }),
    ).toEqual({
      resolution: {
        ok: false,
        code: "PRODUCTION_POSTGRES_REQUIRED",
        message:
          "storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production.",
        requestedMode: "auto",
        production: true,
        allowedModes: ["auto", "memory", "sqlite", "postgres"],
      },
      message:
        'storage.mode.error code=PRODUCTION_POSTGRES_REQUIRED requestedMode=auto production=true message="storage mode auto detected production. Configure DATABASE_URL so Postgres can be used for production."',
    });
  });

  it("emits structured startup status to stdout", () => {
    const writes: string[] = [];

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    });

    const status = emitHttpStorageModeStartupStatus({
      env: {
        STORAGE_MODE: "memory",
      },
    });

    expect(status.resolution).toEqual({
      ok: true,
      mode: "memory",
      productionRecommended: false,
      reason: "memory storage is intended for tests and ephemeral local runs.",
    });

    const events = writes
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      subsystem: "http",
      event: "storage.mode",
      message:
        'storage.mode mode=memory productionRecommended=false reason="memory storage is intended for tests and ephemeral local runs."',
    });
    expect(typeof events[0].ts).toBe("string");
  });

  it("emits structured startup error status to stdout", () => {
    const writes: string[] = [];

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
      writes.push(String(chunk));
      return true;
    });

    const status = emitHttpStorageModeStartupStatus({
      env: {
        NODE_ENV: "production",
      },
    });

    expect(status.resolution).toMatchObject({
      ok: false,
      code: "PRODUCTION_POSTGRES_REQUIRED",
    });

    const events = writes
      .join("")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      subsystem: "http",
      event: "storage.mode.error",
    });
    expect(String(events[0].message)).toContain("PRODUCTION_POSTGRES_REQUIRED");
  });
});