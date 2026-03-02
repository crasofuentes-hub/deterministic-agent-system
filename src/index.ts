import { startServer } from "./http/server";
import { executeDeterministicPlan } from "./agent/executor";
import { executeDeterministicPlanAsync } from "./agent/executor-async";
import type { DeterministicAgentPlan } from "./agent/plan-types";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

function makeDemoPlan(demo: "core" | "sandbox", sandboxUrl: string): DeterministicAgentPlan {
  if (demo === "sandbox") {
    return {
      planId: "agent-demo-sandbox-v1",
      version: 1,
      steps: [
        { id: "a", kind: "sandbox.open", sessionId: "s1", url: sandboxUrl },
        { id: "b", kind: "sandbox.extract", sessionId: "s1", selector: "#title", outputKey: "outTitle" },
        { id: "c", kind: "append_log", value: "fin" }
      ]
    };
  }

  return {
    planId: "agent-demo-plan-v1",
    version: 1,
    steps: [
      { id: "a", kind: "set", key: "mode", value: "agent-demo" },
      { id: "b", kind: "increment", key: "n", value: 1 },
      { id: "c", kind: "increment", key: "n", value: 1 },
      { id: "d", kind: "append_log", value: "fin" }
    ]
  };
}

function parseAgentDemoArgs(argv: string[]): {
  mode: "mock" | "local";
  demo: "core" | "sandbox";
  maxSteps: number;
  traceId: string;
  writeArtifact: boolean;
} {
  let mode: "mock" | "local" = "mock";
  let demo: "core" | "sandbox" = "core";
  let maxSteps = 8;
  let traceId = "trace-agent-demo";
  let writeArtifact = true;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === "--mode") {
      const v = String(argv[i + 1] ?? "");
      if (v !== "mock" && v !== "local") throw new Error("--mode must be 'mock' or 'local'");
      mode = v;
      i += 1;
      continue;
    }

    if (a === "--maxSteps") {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v <= 0) throw new Error("--maxSteps must be a positive integer");
      maxSteps = v;
      i += 1;
      continue;
    }

    if (a === "--traceId") {
      const v = String(argv[i + 1] ?? "");
      if (!v || v.trim().length === 0) throw new Error("--traceId must be a non-empty string");
      traceId = v;
      i += 1;
      continue;
    }

    if (a === "--no-artifact") {
      writeArtifact = false;
      continue;
    }

    if (a === "--demo") {
      const v = String(argv[i + 1] ?? "");
      if (v !== "core" && v !== "sandbox") throw new Error("--demo must be 'core' or 'sandbox'");
      demo = v;
      i += 1;
      continue;
    }
    throw new Error("Unknown arg: " + a);
  }

  return { mode, demo, maxSteps, traceId, writeArtifact };
}
async function runAgentDemo(): Promise<void> {
  const args = parseAgentDemoArgs(process.argv.slice(3));
  const sandboxUrl = "file:///C:/repos/deterministic-agent-system/fixtures/sandbox/site.html";
  const plan = makeDemoPlan(args.demo, sandboxUrl);
  const traceId = args.traceId;
  const mode = args.mode;
  const maxSteps = args.maxSteps;
  const result =
    mode === "local"
      ? await executeDeterministicPlanAsync(plan, { mode, maxSteps, traceId })
      : executeDeterministicPlan(plan, { mode, maxSteps, traceId });

  if (!result.ok) {
    process.stderr.write("agent-demo FAIL: " + result.error.code + " " + result.error.message + "\n");
    process.exitCode = 2;
    return;
  }

  const summary = {
    ok: true,
    traceId,
    planId: result.result.planId,
    planHash: result.result.planHash,
    executionHash: result.result.executionHash,
    finalTraceLinkHash: result.result.finalTraceLinkHash,
    traceLength: result.result.trace.length
  };

  process.stdout.write("agent-demo PASS\n");
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (args.writeArtifact) {
  // Artifact local (no determinista por filename; contenido determinista)
  const outDir = join(process.cwd(), "artifacts", "agent-demo");
  mkdirSync(outDir, { recursive: true });

  const out = {
    summary,
    result: result.result
  };

  const fname = "agent-demo." + Date.now() + ".json";
  const outPath = join(outDir, fname);
  writeFileSync(outPath, JSON.stringify(out, null, 2), { encoding: "utf8" });
  process.stdout.write("artifact: " + outPath + "\n");
  }
}
async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (cmd === "serve") {
    await runServe();
    return;
  }

  if (cmd === "agent-demo") {
    await runAgentDemo();
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
