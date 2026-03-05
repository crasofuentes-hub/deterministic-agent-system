import type { ServerResponse } from "node:http";
import { sendJson } from "../responses";

export async function handleSchemaAgentCapabilities(res: ServerResponse): Promise<void> {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "deterministic-agent-system://schema/agent-capabilities",
    title: "GET /agent/capabilities",
    type: "object",
    additionalProperties: false,
    required: ["ok","result"],
    properties: {
      ok: { type: "boolean", const: true },
      result: {
        type: "object",
        additionalProperties: true,
        required: ["endpoint","planners","demos","modes","bounds","tools","features"],
        properties: {
          endpoint: { type: "string", const: "/agent/run" },
          planners: { type: "array", items: { type: "string" } },
          demos: { type: "array", items: { type: "string" } },
          modes: { type: "array", items: { type: "string" } },
          bounds: { type: "object" },
          tools: { type: "array", items: { type: "string" } },
          features: { type: "object" }
        }
      }
    }
  };

  sendJson(res, 200, { ok: true, result: schema });
}