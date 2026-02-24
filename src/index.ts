import { executeDeterministicPlan } from "./agent";
import type { DeterministicAgentPlan } from "./agent";

function main(): void {
  const plan: DeterministicAgentPlan = {
    planId: "bootstrap-plan-001",
    version: 1,
    steps: [
      { id: "s1", kind: "set", key: "mode", value: "bootstrap" },
      { id: "s2", kind: "increment", key: "iterations", value: 1 },
      { id: "s3", kind: "append_log", value: "bootstrap executed" }
    ]
  };

  const result = executeDeterministicPlan(plan, {
    mode: "local",
    maxSteps: 10,
    traceId: "trace-bootstrap-001"
  });

  console.log("Deterministic Agent System");

  if (result.ok) {
    console.log("Bootstrap repository initialized.");
    console.log("Deterministic executor demo PASS.");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error("Deterministic executor demo FAIL.");
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}

main();