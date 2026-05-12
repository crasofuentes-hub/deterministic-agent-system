# LLM Live Verified Planner Prompt Input Mode

LLM-live now supports an explicit verified planner prompt input mode.

This mode allows `llmPlanText` to contain planner prompt output instead of the classic deterministic agent plan format.

## Current status

Implemented:

- classic `llmPlanText` mode remains the default
- explicit verified planner prompt mode
- planner prompt output validation
- deterministic plan verifier integration
- bridge to `DeterministicAgentPlan`
- canonicalization through the existing runtime plan contract
- contractual tests for both classic and verified modes

## Implementation files

    src/agent-run/planner-llm-live.ts
    src/agent-run/types.ts
    src/agent-run/llm-live-planner-contract.ts
    src/agent-run/llm-live-planner-bridge.ts

## Tests

    tests/agent-run/llm-live-verified-planner-input-mode.test.ts
    tests/agent-run/llm-live-planner-contract.test.ts
    tests/agent-run/llm-live-planner-bridge.test.ts

## Classic mode

By default, `llmPlanText` is interpreted as a deterministic agent plan:

    {
      "planId": "classic-plan-v1",
      "version": 1,
      "steps": [
        {
          "id": "a",
          "kind": "set",
          "key": "goal",
          "value": "sum 2 3"
        }
      ]
    }

This default behavior is preserved.

Equivalent input:

    llmPlanTextFormat: "deterministic-agent-plan"

## Verified planner prompt mode

To use the new verified planner prompt path, set:

    llmPlanTextFormat: "planner-prompt-output"

Required fields:

    llmPlanText
    llmPlanTextFormat
    llmPlannerAvailableTools

Optional field:

    llmVerifiedPlanId

Example input body fragment:

    {
      "planner": "llm-live",
      "llmPlanTextFormat": "planner-prompt-output",
      "llmVerifiedPlanId": "verified-planner-mode-v1",
      "llmPlannerAvailableTools": [
        {
          "name": "policy.coverage.get",
          "description": "Get coverage details for a policy.",
          "parametersSchema": {
            "type": "object",
            "required": ["policyId"],
            "additionalProperties": false,
            "properties": {
              "policyId": {
                "type": "string"
              }
            }
          }
        }
      ],
      "llmPlanText": "{...planner prompt output JSON...}"
    }

## Verified planner output shape

In verified planner prompt mode, `llmPlanText` must contain:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

The output is validated by:

    deterministicPlannerPromptContract.validateOutput(...)

Then verified by:

    verifyDeterministicPlan(...)

Then bridged by:

    bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan(...)

## Bridge output

Each verified planner step is converted into a deterministic tool call step:

    {
      "id": "llm_tool_0001",
      "kind": "tool.call",
      "toolId": "<planner step tool>",
      "input": {
        "...": "..."
      },
      "outputKey": "llm_step_1"
    }

## Required tools

Verified planner prompt mode requires:

    llmPlannerAvailableTools

If tools are missing, the system rejects the request with:

    llm_live_verified_planner_prompt_tools_required

This prevents unverifiable planner output from entering the runtime.

## Invalid planner prompt output

Invalid planner prompt output is rejected before bridge output is produced.

The contract error is:

    LLM_LIVE_PLANNER_CONTRACT_INVALID

This protects the runtime from:

- invented tools
- malformed JSON
- hidden reasoning fields
- missing required parameters
- invalid dependencies
- clarification outputs used as executable plans

## Compatibility guarantee

This change does not replace the classic deterministic agent plan parser.

Classic mode remains:

    llmPlanText
    parseDeterministicPlanFromModelText(...)
    canonicalizePlan(...)

Verified planner prompt mode is explicit:

    llmPlanTextFormat: "planner-prompt-output"

## Contractual coverage

The mode is included in:

    test:llm-live:contractual
    test:baseline:contractual

This ensures future changes cannot silently break the verified planner path.