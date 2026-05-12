# Verified Planner Prompt Mode Architecture Guard

The verified planner prompt mode is intentionally explicit.

It must never become the default behavior for `llmPlanText`.

## Guarded rule

Default behavior:

    llmPlanTextFormat omitted
    -> deterministic-agent-plan

Explicit verified planner behavior:

    llmPlanTextFormat: "planner-prompt-output"

## Why this guard exists

LLM-live currently supports two different text contracts.

Classic deterministic agent plan text:

    planId
    version
    steps

Verified planner prompt output:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

These contracts are intentionally separate.

If the verified planner prompt mode became implicit, existing users of classic `llmPlanText` could break.

## Protected files

The guard protects behavior in:

    src/agent-run/planner-llm-live.ts
    src/http/handlers/agent-run.ts
    src/http/handlers/schema-agent-run.ts

## Test

Architecture guard:

    tests/architecture/verified-planner-prompt-mode-explicit.test.ts

The test verifies:

- `deterministic-agent-plan` remains the default format.
- `planner-prompt-output` is only used when explicitly requested.
- planner tools are required before verified planner output can be bridged.
- HTTP `/agent/run` passes verified planner fields explicitly.
- HTTP schema documents the new optional fields.
- verified planner fields are not added to required fields.

## Required explicit fields

To use verified planner prompt mode through `/agent/run`, request bodies must include:

    llmPlanTextFormat: "planner-prompt-output"
    llmPlannerAvailableTools: [...]

Optional:

    llmVerifiedPlanId

## Failure protection

If verified planner prompt mode is requested without declared tools, the runtime rejects the request with:

    llm_live_verified_planner_prompt_tools_required

If verified planner output violates contract, it is rejected before execution through:

    LLM_LIVE_PLANNER_CONTRACT_INVALID

and mapped into the existing LLM-live invalid plan path.

## Compatibility guarantee

Classic LLM-live plan text remains compatible.

This still works without specifying `llmPlanTextFormat`:

    {
      "planId": "classic-plan-v1",
      "version": 1,
      "steps": [...]
    }

## Related docs

    docs/llm-live-verified-planner-input-mode.md
    docs/llm-live-verified-planner-bridge.md
    docs/llm-live-planner-contract-boundary.md
    docs/deterministic-planner-prompt-v1.1.md