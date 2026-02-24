import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function prefixedSha256(prefix: string, input: string): string {
  return prefix + sha256Hex(input);
}