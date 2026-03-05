import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ToolRegistry, toolEcho, toolMathAdd } from "../tools";
import type { ReplayManifestV1, ReplayToolManifestEntry, ReplayPlannerId } from "./bundle";

function loadPackageMeta(): { name: string; version: string } {
  const p = join(process.cwd(), "package.json");
  const raw = readFileSync(p, "utf8");
  const j = JSON.parse(raw) as any;
  return { name: String(j.name ?? ""), version: String(j.version ?? "") };
}

export function buildReplayManifest(params: {
  planner: ReplayPlannerId;
  traceSchemaVersion: number;
}): ReplayManifestV1 {
  const pkg = loadPackageMeta();

  const reg = new ToolRegistry([toolEcho, toolMathAdd]);
  const tools: ReplayToolManifestEntry[] = reg.listIds().map((id) => {
    const t = reg.get(id as any);
    return { id, version: t ? t.version : 1 };
  });

  tools.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    packageName: pkg.name,
    packageVersion: pkg.version,
    traceSchemaVersion: params.traceSchemaVersion,
    tools,
  };
}