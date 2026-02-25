import { startServer } from "./http/server";

function printBanner(): void {
  const lines = [
    "Deterministic Agent System",
    "Deterministic execution runtime for bounded autonomous agents",
    "",
    "Available capabilities (current build):",
    "- Deterministic agent execution core",
    "- Replay verification (E2E)",
    "- Deterministic HTTP contracts",
    "- Provider simulation/model foundation",
    "- Bounded tool execution (/tool/execute)",
    "- Health endpoint (/health) and request IDs",
    "",
    "Next milestones:",
    "- Run registry and agent run contracts",
    "- Streaming run events",
    "- Cancellation and bounded orchestration",
    "",
    "Usage:",
    "- npm run build",
    "- npm test",
    "- node dist/src/index.js serve",
    "",
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

async function runServe(): Promise<void> {
  const running = await startServer({ port: 3000, host: "127.0.0.1" });
  process.stdout.write(
    "HTTP server listening on http://" + running.host + ":" + running.port + "\n"
  );
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (cmd === "serve") {
    await runServe();
    return;
  }

  printBanner();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write("Fatal error: " + message + "\n");
  process.exitCode = 1;
});
export * from "./agent-run";
