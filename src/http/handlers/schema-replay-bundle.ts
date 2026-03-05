import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";

export async function handleSchemaReplayBundle(res: ServerResponse): Promise<void> {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "deterministic-agent-system://schema/replay-bundle",
    title: "Replay bundle (v1/v2)",
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["schema","version","planner","input","resultHashes"],
        properties: {
          schema: { type: "string", const: "deterministic-agent-system.replay-bundle" },
          version: { type: "integer", const: 1 },
          planner: { type: "string" },
          input: { type: "object" },
          resultHashes: {
            type: "object",
            additionalProperties: false,
            required: ["planHash","executionHash","finalTraceLinkHash","traceSchemaVersion"],
            properties: {
              planHash: { type: "string" },
              executionHash: { type: "string" },
              finalTraceLinkHash: { type: "string" },
              traceSchemaVersion: { type: "integer" }
            }
          }
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["schema","version","planner","input","resultHashes","manifest"],
        properties: {
          schema: { type: "string", const: "deterministic-agent-system.replay-bundle" },
          version: { type: "integer", const: 2 },
          planner: { type: "string" },
          input: { type: "object" },
          resultHashes: {
            type: "object",
            additionalProperties: false,
            required: ["planHash","executionHash","finalTraceLinkHash","traceSchemaVersion"],
            properties: {
              planHash: { type: "string" },
              executionHash: { type: "string" },
              finalTraceLinkHash: { type: "string" },
              traceSchemaVersion: { type: "integer" }
            }
          },
          manifest: {
            type: "object",
            additionalProperties: false,
            required: ["nodeVersion","platform","arch","packageName","packageVersion","traceSchemaVersion","tools"],
            properties: {
              nodeVersion: { type: "string" },
              platform: { type: "string" },
              arch: { type: "string" },
              packageName: { type: "string" },
              packageVersion: { type: "string" },
              traceSchemaVersion: { type: "integer" },
              tools: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id","version"],
                  properties: { id: { type: "string" }, version: { type: "integer" } }
                }
              }
            }
          }
        }
      }
    ]
  };

  sendJson(res, 200, { ok: true, result: schema });
}