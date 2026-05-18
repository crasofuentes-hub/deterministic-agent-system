import { describe, expect, it } from "vitest";
import { handleAgentRun } from "../../src/http/handlers/agent-run";
import type {
  VerifiedPlannerJournalAppendInput,
  VerifiedPlannerJournalWriter,
} from "../../src/journal";

function createMockResponse() {
  let body = "";
  const headers: Record<string, string> = {};

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    end(value?: string) {
      body = value ?? "";
    },
    getBody() {
      return body;
    },
    getHeaders() {
      return headers;
    },
  };
}

async function flushAsyncSink(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("agent run verified planner journal sink integration", () => {
  it("records verified planner journal events when journal option is provided", async () => {
    const events: VerifiedPlannerJournalAppendInput[] = [];

    const journal: VerifiedPlannerJournalWriter = {
      async appendEvent(event) {
        events.push(event);
      },
    };

    const response = createMockResponse();

    await handleAgentRun(
      response as any,
      {
        goal: "sum 2 3",
        demo: "core",
        mode: "mock",
        planner: "llm-live",
        llmProvider: "openai-compatible",
        llmPlanTextFormat: "planner-prompt-output",
        llmVerifiedPlanId: "verified-planner-journal-http-v1",
        llmPlannerAvailableTools: [
          {
            name: "math/add",
            description: "Add two numbers deterministically.",
            parametersSchema: {
              type: "object",
              required: ["a", "b"],
              additionalProperties: false,
              properties: {
                a: {
                  type: "number",
                },
                b: {
                  type: "number",
                },
              },
            },
          },
        ],
        llmPlanText: JSON.stringify({
          decisionSummary: "The request includes two numbers, so math/add is sufficient.",
          requiresClarification: false,
          clarificationQuestion: null,
          assumptions: [],
          missingInputs: [],
          steps: [
            {
              step: 1,
              tool: "math/add",
              parameters: {
                a: 2,
                b: 3,
              },
              explanation: "Compute deterministic sum.",
            },
          ],
        }),
        maxSteps: 12,
        traceId: "trace-agent-run-verified-planner-journal-001",
        tenantId: "tenant-verified-planner-http",
        subjectId: "api-key-verified-planner-http",
        scopes: ["agent:run", "journal:write"],
      },
      {
        journal,
      },
    );

    await flushAsyncSink();

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.getBody());
    expect(body.ok).toBe(true);

    expect(events.map((event) => event.type)).toEqual([
      "planner_prompt_received",
      "planner_prompt_verified",
      "planner_bridge_created_plan",
    ]);

    expect(events[0]).toMatchObject({
      eventId:
        "verified-planner:trace-agent-run-verified-planner-journal-001:planner_prompt_received",
      sessionId: "agent-run:trace-agent-run-verified-planner-journal-001",
      payload: {
        traceId: "trace-agent-run-verified-planner-journal-001",
        tenantId: "tenant-verified-planner-http",
        llmPlanTextFormat: "planner-prompt-output",
        promptContractId: "planner.deterministic",
        promptContractVersion: "1.1.0",
        toolNames: ["math/add"],
      },
    });

    expect(events[1]).toMatchObject({
      eventId:
        "verified-planner:trace-agent-run-verified-planner-journal-001:planner_prompt_verified",
      sessionId: "agent-run:trace-agent-run-verified-planner-journal-001",
      payload: {
        traceId: "trace-agent-run-verified-planner-journal-001",
        tenantId: "tenant-verified-planner-http",
        planId: "verified-planner-journal-http-v1",
        executable: true,
      },
    });

    expect(events[2]).toMatchObject({
      eventId:
        "verified-planner:trace-agent-run-verified-planner-journal-001:planner_bridge_created_plan",
      sessionId: "agent-run:trace-agent-run-verified-planner-journal-001",
      payload: {
        traceId: "trace-agent-run-verified-planner-journal-001",
        tenantId: "tenant-verified-planner-http",
        planId: "verified-planner-journal-http-v1",
        stepCount: 1,
      },
    });
  });

  it("does not record journal events when journal option is absent", async () => {
    const response = createMockResponse();

    await handleAgentRun(response as any, {
      goal: "sum 2 3",
      demo: "core",
      mode: "mock",
      planner: "llm-live",
      llmProvider: "openai-compatible",
      llmPlanTextFormat: "planner-prompt-output",
      llmVerifiedPlanId: "verified-planner-no-journal-v1",
      llmPlannerAvailableTools: [
        {
          name: "math/add",
          description: "Add two numbers deterministically.",
          parametersSchema: {
            type: "object",
            required: ["a", "b"],
            additionalProperties: false,
            properties: {
              a: {
                type: "number",
              },
              b: {
                type: "number",
              },
            },
          },
        },
      ],
      llmPlanText: JSON.stringify({
        decisionSummary: "The request includes two numbers, so math/add is sufficient.",
        requiresClarification: false,
        clarificationQuestion: null,
        assumptions: [],
        missingInputs: [],
        steps: [
          {
            step: 1,
            tool: "math/add",
            parameters: {
              a: 2,
              b: 3,
            },
            explanation: "Compute deterministic sum.",
          },
        ],
      }),
      maxSteps: 12,
      traceId: "trace-agent-run-verified-planner-no-journal-001",
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.getBody()).ok).toBe(true);
  });
});