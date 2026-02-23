export function sanitizeInline(text: string | undefined): string {
  if (typeof text === "undefined") return "";
  return text.replace(/[\r\n]+/g, " ").replace(/\|/g, "/");
}

export function joinLines(lines: string[]): string {
  return lines.join("\n");
}

export function utcStamp(): string {
  // ISO stable UTC
  return new Date().toISOString();
}