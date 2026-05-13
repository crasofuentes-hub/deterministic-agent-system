import {
  formatStorageModeStartupMessage,
  resolveRuntimeStorageMode,
  type RuntimeStorageModeInput,
  type StorageModeResolution,
} from "../storage";

export interface HttpStorageModeStartupStatus {
  readonly resolution: StorageModeResolution;
  readonly message: string;
}

export function resolveHttpStorageModeStartupStatus(
  input: RuntimeStorageModeInput = {},
): HttpStorageModeStartupStatus {
  const resolution = resolveRuntimeStorageMode(input);

  return {
    resolution,
    message: formatStorageModeStartupMessage(resolution),
  };
}

export function emitHttpStorageModeStartupStatus(
  input: RuntimeStorageModeInput = {},
): HttpStorageModeStartupStatus {
  const status = resolveHttpStorageModeStartupStatus(input);

  const event = {
    ts: new Date().toISOString(),
    subsystem: "http",
    event: status.resolution.ok ? "storage.mode" : "storage.mode.error",
    message: status.message,
  };

  process.stdout.write(JSON.stringify(event) + "\n");

  return status;
}