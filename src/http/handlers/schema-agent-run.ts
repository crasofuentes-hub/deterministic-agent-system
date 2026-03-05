import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";

export async function handleSchemaAgentRun(res: ServerResponse): Promise<void> {
  // JSON Schema draft 2020-12 (minimally strict, aligned to current contract)
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "deterministic-agent-system://schema/agent-run",
    title: "POST /agent/run",
    type: "object",
    additionalProperties: false,
    properties: {
      request: {
        type: "object",
        additionalProperties: false,
        required: ["goal", "demo", "mode", "maxSteps"],
        properties: {
          goal: { type: "string", minLength: 1 },
          demo: { type: "string", enum: ["core", "sandbox"] },
          mode: { type: "string", enum: ["mock", "local"] },
          maxSteps: { type: "integer", minimum: 1 },
          planner: { type: "string", enum: ["mock", "deterministic", "det-tools", "det-replan", "det-replan2", "llm-mock"] },
          traceId: { type: "string", minLength: 1, maxLength: 256 },
          sandboxUrl: { type: "string", minLength: 1, maxLength: 2048 },
          history: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["role", "content"],
              properties: {
                role: { type: "string", enum: ["user", "assistant"] },
                content: { type: "string" }
              }
            }
          },
          lastErrorCode: { type: "string" }
        }
      },
      response: {
        // DeterministicResponse<AgentExecutionResult> shape
        type: "object",
        additionalProperties: true,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          result: {
            type: "object",
            additionalProperties: true,
            required: ["planId","planHash","executionHash","finalTraceLinkHash","traceSchemaVersion","stepsRequested","stepsExecuted","converged","finalState","trace"],
            properties: {
              planId: { type: "string" },
              planHash: { type: "string" },
              executionHash: { type: "string" },
              finalTraceLinkHash: { type: "string" },
              traceSchemaVersion: { type: "integer" },
              stepsRequested: { type: "integer" },
              stepsExecuted: { type: "integer" },
              converged: { type: "boolean" },
              finalState: {
                type: "object",
                additionalProperties: false,
                required: ["counters","values","logs"],
                properties: {
                  counters: { type: "object", additionalProperties: { type: "integer" } },
                  values: { type: "object", additionalProperties: { type: "string" } },
                  logs: { type: "array", items: { type: "string" } }
                }
              },
              trace: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["traceSchemaVersion","stepIndex","stepId","kind","beforeHashLike","afterHashLike","traceLinkHash","previousTraceLinkHash","applied"],
                  properties: {
                    traceSchemaVersion: { type: "integer" },
                    stepIndex: { type: "integer" },
                    stepId: { type: "string" },
                    kind: { type: "string" },
                    beforeHashLike: { type: "string" },
                    afterHashLike: { type: "string" },
                    traceLinkHash: { type: "string" },
                    previousTraceLinkHash: { type: "string" },
                    applied: { type: "boolean" }
                  }
                }
              }
            }
          },
          error: {
            type: "object",
            additionalProperties: true,
            required: ["code","message","retryable"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              retryable: { type: "boolean" }
            }
          },
          meta: { type: "object", additionalProperties: true }
        }
      }
    }
  };

  sendJson(res, 200, { ok: true, result: schema });
}