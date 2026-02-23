import { execFileSync } from "node:child_process";
import { fileSize, resolveRepoPath, runStep, writeUtf8NoBom } from "./lib/io";
import { joinLines, sanitizeInline, utcStamp } from "./lib/markdown";

function tryGitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function main(): void {
  const results: Array<{ name: string; ok: boolean; durationMs: number; error?: string }> = [];

  results.push(
    runStep("node dist/scripts/verify-bootstrap.js", () => {
      execFileSync("node", [resolveRepoPath("dist", "scripts", "verify-bootstrap.js")], {
        stdio: "inherit",
      });
    })
  );

  const overall = results.every((r) => r.ok) ? "PASS" : "FAIL";
  const commit = tryGitCommit();

  const lines: string[] = [];
  lines.push("# BOOTSTRAP_STATUS");
  lines.push("");
  lines.push("## Deterministic Agent System Bootstrap Verification Status");
  lines.push("");
  lines.push("- Generated (UTC): " + utcStamp());
  if (commit) {
    lines.push("- Git commit: " + commit);
  }
  lines.push("- Overall status: **" + overall + "**");
  lines.push("");
  lines.push("### Results");
  lines.push("");

  for (const r of results) {
    lines.push("#### " + r.name);
    lines.push("- Status: **" + (r.ok ? "PASS" : "FAIL") + "**");
    lines.push("- DurationMs: " + String(r.durationMs));
    if (!r.ok && r.error) {
      lines.push("- Error: " + sanitizeInline(r.error));
    }
    lines.push("");
  }

  lines.push("### Notes");
  lines.push("");
  lines.push("- Status generated with TypeScript cross-platform tooling.");
  lines.push("- Output encoded as UTF-8.");
  lines.push("- Suitable for CI usage on Windows, Linux, and macOS.");
  lines.push("");

  const outPath = resolveRepoPath("BOOTSTRAP_STATUS.md");
  writeUtf8NoBom(outPath, joinLines(lines));

  if (fileSize(outPath) < 100) {
    throw new Error("BOOTSTRAP_STATUS.md unexpectedly small");
  }

  console.log("OK: status generated ->", outPath);

  if (overall !== "PASS") {
    throw new Error("Bootstrap status generation failed");
  }
}

main();