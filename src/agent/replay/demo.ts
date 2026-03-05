import { writeFileSync, readFileSync } from "node:fs";
import { buildReplayBundle, replayBundleToJson, type ReplayBundleV1, type ReplayPlannerId } from "./bundle";
import { executeForReplay, verifyReplayBundle } from "./replay";

function parseArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return def;
  const v = process.argv[idx + 1];
  return typeof v === "string" ? v : def;
}

async function main(): Promise<void> {
  const outPath = parseArg("--out", "replay-bundle.json")!;
  const planner = (parseArg("--planner", "llm-mock") as ReplayPlannerId) ?? "llm-mock";
  const goal = parseArg("--goal", "sum 2 3")!;
  const mode = (parseArg("--mode", "mock") as "mock" | "local") ?? "mock";
  const demo = (parseArg("--demo", "core") as "core" | "sandbox") ?? "core";
  const maxSteps = Number(parseArg("--maxSteps", "12") ?? "12");

  const input = {
    goal,
    demo,
    mode,
    planner,
    maxSteps,
    traceId: "replay-demo-001", // estable
  };

  const r = await executeForReplay(input, planner);
  if (!r.ok) {
    console.error(JSON.stringify({ ok: false, error: r.error }, null, 0));
    process.exitCode = 1;
    return;
  }

  const bundle = buildReplayBundle({ planner, input, result: r.result });
  const json = replayBundleToJson(bundle);
  writeFileSync(outPath, json + "\n", { encoding: "utf8" });

  const loaded = JSON.parse(readFileSync(outPath, "utf8")) as ReplayBundleV1;
  const verify = await verifyReplayBundle(loaded);

  console.log(JSON.stringify({ ok: true, outPath, verify }, null, 0));
  if (!verify.ok) process.exitCode = 2;
}

void main();