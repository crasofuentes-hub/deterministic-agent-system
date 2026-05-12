# LLM Live Verified Planner Bridge

The LLM-live verified planner bridge converts validated planner prompt output into the existing deterministic agent plan format.

This keeps the new professional prompt contract separate from the legacy/current `DeterministicAgentPlan` parser while still allowing a safe bridge between both contracts.

## Current status

Implemented:

- Bridge from `PlannerPromptOutput` to `DeterministicAgentPlan`.
- Bridge from verified planner prompt text to `DeterministicAgentPlan`.
- Canonicalization through `canonicalizePlan`.
- Deterministic tool-call step generation.
- Deterministic step ids.
- Deterministic output keys.
- Rejection of clarification outputs before plan generation.
- Rejection of invalid planner prompt text before bridge output.
- Contractual tests for the bridge.

## Implementation files

    src/agent-run/llm-live-planner-bridge.ts
    src/agent-run/index.ts

Related files:

    src/agent-run/llm-live-planner-contract.ts
    src/prompts/planner/planner-contract-v1-1.ts
    src/planner/plan-verifier.ts
    src/agent/canonical-plan.ts

## Tests

    tests/agent-run/llm-live-planner-bridge.test.ts

Related tests:

    tests/agent-run/llm-live-planner-contract.test.ts
    tests/prompts/planner-prompt-v1-1.test.ts
    tests/planner/deterministic-plan-verifier.test.ts

## Bridge flow

The bridge supports this flow:

    PlannerPromptOutput
    bridgeVerifiedPlannerOutputToAgentPlan(...)
    DeterministicAgentPlan
    canonicalizePlan(...)

It also supports this full text flow:

    LLM planner prompt text
    assertVerifiedLlmLivePlannerPromptText(...)
    bridgeVerifiedPlannerOutputToAgentPlan(...)
    DeterministicAgentPlan
    canonicalizePlan(...)

## Generated agent plan shape

The generated agent plan uses the existing deterministic runtime contract:

    planId
    version: 1
    steps

Each planner step becomes:

    kind: tool.call
    toolId: <planner step tool>
    input: <planner step parameters>
    outputKey: <deterministic output key>

Example generated step:

    {
      "id": "tool_0001",
      "kind": "tool.call",
      "toolId": "policy.coverage.get",
      "input": {
        "policyId": "POL-AUTO-1001"
      },
      "outputKey": "step_1"
    }

## Deterministic ids

Default step id format:

    tool_0001
    tool_0002
    tool_0003

Custom step id prefixes are supported through:

    stepIdPrefix

Default output key format:

    step_1
    step_2
    step_3

Custom output key prefixes are supported through:

    outputKeyPrefix

## Clarification behavior

Planner outputs that require clarification are not executable.

The bridge rejects them with:

    llm_live_planner_bridge_requires_executable_plan

This prevents a clarification response from being accidentally converted into an executable agent plan.

## Invalid planner output behavior

Invalid planner prompt text is rejected before bridge output is produced.

The boundary returns deterministic errors through:

    LLM_LIVE_PLANNER_CONTRACT_INVALID

## Why this is separate from parser replacement

The existing `planner-llm-live.ts` parser still accepts direct deterministic agent plan text:

    planId
    version
    steps

The verified planner bridge accepts the newer planner prompt contract:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

Those contracts remain separate.

This bridge is the safe compatibility layer between both.

## Next integration

The next technical step is to expose a mode that lets `planner-llm-live.ts` use verified planner prompt text explicitly, without breaking classic `llmPlanText`.

Recommended commit:

    feat(llm-live): support verified planner prompt input mode

Expected behavior:

- classic `llmPlanText` keeps using `parseDeterministicPlanFromModelText`
- verified planner text uses the prompt contract boundary and bridge
- old `test:llm-live:contractual` remains green
- new tests prove verified planner prompt mode

## Verified planner prompt input mode

LLM-live now exposes the verified planner bridge through an explicit input mode:

    llmPlanTextFormat: "planner-prompt-output"

See:

    docs/llm-live-verified-planner-input-mode.md

Current implementation:

    src/agent-run/planner-llm-live.ts

Current tests:

    tests/agent-run/llm-live-verified-planner-input-mode.test.ts
