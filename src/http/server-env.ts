export interface ServeEnvConfig {
  readonly host: string;
  readonly port: number;
}

function readTrimmedNonEmpty(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(value: string | undefined): number {
  const normalized = value ?? "3000";

  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error("PORT must be a TCP port between 1 and 65535");
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be a TCP port between 1 and 65535");
  }

  return parsed;
}

export function resolveServeEnv(
  env: Record<string, string | undefined>,
): ServeEnvConfig {
  return {
    host: readTrimmedNonEmpty(env, "HOST") ?? "127.0.0.1",
    port: parsePort(readTrimmedNonEmpty(env, "PORT")),
  };
}