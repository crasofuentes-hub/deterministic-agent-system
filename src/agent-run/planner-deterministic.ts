import { createHash } from "node:crypto";
import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stablePlanId(prefix: string, goal: string): string {
  const h = sha256Hex(goal.normalize("NFC"));
  return prefix + "-" + h.slice(0, 16);
}

export class DeterministicPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const planId = stablePlanId(
      input.demo === "sandbox" ? "agent-run-sandbox-v1" : "agent-run-core-v1",
      input.goal
    );

    if (input.demo === "sandbox") {
      // sandboxUrl debe venir validada desde el handler HTTP.
      const sandboxUrl = (input as any).sandboxUrl as string;

      return {
        planId,
        version: 1,
        steps: [
          { id: "a", kind: "sandbox.open", sessionId: "s1", url: sandboxUrl },
          { id: "b", kind: "sandbox.extract", sessionId: "s1", selector: "#title", outputKey: "title" },
          { id: "c", kind: "append_log", value: "done" }
        ],
      };
    }

    return {
      planId,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: input.goal },
        { id: "b", kind: "append_log", value: "done" }
      ],
    };
  }
}