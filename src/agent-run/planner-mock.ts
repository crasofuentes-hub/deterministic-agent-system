import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";

export class MockPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    if (input.demo === "sandbox") {
      const url = "http://127.0.0.1:4319/"; // fixture server
      return {
        planId: "agent-run-sandbox-v1",
        version: 1,
        steps: [
          { id: "a", kind: "sandbox.open", sessionId: "s1", url },
          { id: "b", kind: "sandbox.extract", sessionId: "s1", selector: "#title", outputKey: "title" },
          { id: "c", kind: "append_log", value: "done" },
        ],
      };
    }

    return {
      planId: "agent-run-core-v1",
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: input.goal },
        { id: "b", kind: "increment", key: "n", value: 1 },
        { id: "c", kind: "append_log", value: "done" },
      ],
    };
  }
}