import type { DeterministicAgentPlan } from "../agent/plan-types";
import type { AgentRunInput, Planner } from "./types";
import { normalizeGoal, deriveIntent } from "./spec";
import { resolveToolIdForCapability } from "../agent/tools";
import { synthesizeCapabilitiesFromGoal } from "./capability-synthesis";
import { buildCapabilitySynthPlan } from "./capability-pipeline";

function parseTwoInts(goal: string): { a: number; b: number } | null {
  const m = goal.match(/\b(-?\d+)[^-0-9]+(-?\d+)\b/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return { a, b };
}

function s(x: unknown): string {
  return typeof x === "string" ? x : String(x ?? "");
}

export class LlmMockPlanner implements Planner {
  plan(input: AgentRunInput): DeterministicAgentPlan {
    const goal = normalizeGoal(input.goal);
    const intent = deriveIntent(goal);

    const lastErr = s(input.lastErrorCode).trim();

    if (lastErr.startsWith("TOOL_")) {
      const msg = "replan2:" + lastErr;
      return {
        planId: "agent-run-llm-mock-replan2-v1:" + intent + ":" + lastErr,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "set", key: "lastErrorCode", value: lastErr },
          { id: "d", kind: "append_log", value: msg },
          { id: "e", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "sum" },
          { id: "f", kind: "append_log", value: "done" }
        ]
      };
    }

    if (goal.includes("missingtool")) {
      return {
        planId: "agent-run-llm-mock-v1:" + intent + ":missingtool",
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          { id: "d", kind: "tool.call", toolId: "nope/tool", input: { x: 1 }, outputKey: "out" },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }

    if (intent === "compute") {
      const p = parseTwoInts(goal);
      const a = p ? p.a : 1;
      const b = p ? p.b : 2;

      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          { id: "d", kind: "tool.call", toolId: "math/add", input: { a, b }, outputKey: "sum" },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }

    if (intent === "normalize") {
      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          {
            id: "d",
            kind: "tool.call",
            toolId: "text/normalize",
            input: {
              text: goal,
              trim: true,
              lowercase: true,
              collapseWhitespace: true
            },
            outputKey: "normalized"
          },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }
    if (intent === "cap-synth") {
      const caps = synthesizeCapabilitiesFromGoal(goal);
      return buildCapabilitySynthPlan({
        plannerPrefix: "llm-mock",
        goal,
        intent,
        capabilities: caps
      });
    }


    if (intent === "extract-merge") {
      const rawJson = '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } , "meta" : { "ok" : true } }  ';
      const normalizeToolId = resolveToolIdForCapability("text.normalize");
      const extractToolId = resolveToolIdForCapability("json.extract");
      const mergeToolId = resolveToolIdForCapability("json.merge");
      const extraJson = JSON.stringify({ source: "llm-mock", workflow: "extract-merge" });

      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          {
            id: "d",
            kind: "tool.call",
            toolId: normalizeToolId,
            input: {
              text: rawJson,
              trim: true,
              lowercase: false,
              collapseWhitespace: true
            },
            outputKey: "normalizedJson"
          },
          {
            id: "e",
            kind: "tool.call",
            toolId: extractToolId,
            input: {
              text: { "$ref": "state.values.normalizedJson.text" },
              path: "user"
            },
            outputKey: "extractedUser"
          },
          {
            id: "f",
            kind: "tool.call",
            toolId: mergeToolId,
            input: {
              left: { "$ref": "state.values.extractedUser.value" },
              right: extraJson
            },
            outputKey: "merged"
          },
          { id: "g", kind: "append_log", value: "done" }
        ]
      };
    }

    if (intent === "extract") {
      const path =
        goal.includes("name") ? "user.name" :
        goal.includes("role") ? "user.role" :
        "items.0.id";

      const text = JSON.stringify({
        user: { name: "Oscar", role: "inventor" },
        items: [{ id: "a1" }, { id: "b2" }]
      });

      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          {
            id: "d",
            kind: "tool.call",
            toolId: "json/extract",
            input: { text, path },
            outputKey: "extracted"
          },
          { id: "e", kind: "append_log", value: "done" }
        ]
      };
    }

    if (intent === "extract-chain") {
      const rawJson = '  {  "user" : { "name" : "Oscar" , "role" : "inventor" } , "items" : [ { "id" : "a1" } , { "id" : "b2" } ] }  ';
      const path = goal.includes("role") ? "user.role" : "user.name";

      return {
        planId: "agent-run-llm-mock-v1:" + intent,
        version: 1,
        steps: [
          { id: "a", kind: "set", key: "goal", value: goal },
          { id: "b", kind: "set", key: "intent", value: intent },
          { id: "c", kind: "append_log", value: "llm-mock:plan" },
          {
            id: "d",
            kind: "tool.call",
            toolId: "text/normalize",
            input: {
              text: rawJson,
              trim: true,
              lowercase: false,
              collapseWhitespace: true
            },
            outputKey: "normalizedJson"
          },
          {
            id: "e",
            kind: "tool.call",
            toolId: "json/extract",
            input: {
              text: { "$ref": "state.values.normalizedJson.text" },
              path
            },
            outputKey: "extracted"
          },
          { id: "f", kind: "append_log", value: "done" }
        ]
      };
    }

    const msg = "llm-mock:" + intent;
    return {
      planId: "agent-run-llm-mock-v1:" + intent,
      version: 1,
      steps: [
        { id: "a", kind: "set", key: "goal", value: goal },
        { id: "b", kind: "set", key: "intent", value: intent },
        { id: "c", kind: "append_log", value: "llm-mock:plan" },
        { id: "d", kind: "tool.call", toolId: "echo", input: { value: msg }, outputKey: "output" },
        { id: "e", kind: "append_log", value: "done" }
      ]
    };
  }
}