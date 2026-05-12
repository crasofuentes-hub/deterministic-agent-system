# Verified Planner Prompt LLM-live Demo

This demo proves the verified planner prompt path through the real `/agent/run` HTTP flow.

It demonstrates:

- `planner=llm-live`
- `llmPlanTextFormat=planner-prompt-output`
- declared tool surface
- planner prompt output validation
- deterministic plan verifier
- bridge to `DeterministicAgentPlan`
- canonical runtime execution
- deterministic hashes

## Script

    src/scripts/demo-verified-planner-llm-live.ts

## NPM command

    npm run demo:agent:llm-live:verified-planner

## Execution

PowerShell:

    Set-Location "C:\repos\deterministic-agent-system"
    $ErrorActionPreference = "Stop"

    npm run build
    npm run demo:agent:llm-live:verified-planner

## What the demo does

The demo starts the HTTP server on a random local port and sends:

    POST /agent/run

with:

    planner: "llm-live"
    llmProvider: "openai-compatible"
    llmPlanTextFormat: "planner-prompt-output"

The request includes a declared tool surface:

    math/add

and planner prompt output:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

## Verified planner path

The runtime follows this path:

    HTTP request
    parseAgentRunInput(...)
    planner=llm-live
    llmPlanTextFormat="planner-prompt-output"
    materializePlanFromLlmPlanText(...)
    bridgeVerifiedLlmLivePlannerPromptTextToAgentPlan(...)
    assertVerifiedLlmLivePlannerPromptText(...)
    deterministicPlannerPromptContract.validateOutput(...)
    verifyDeterministicPlan(...)
    bridgeVerifiedPlannerOutputToAgentPlan(...)
    canonicalizePlan(...)
    executor

## Expected output

The demo prints a JSON summary containing:

    demo
    request
    result.planId
    result.planHash
    result.executionHash
    result.finalTraceLinkHash
    result.finalStateValues

Example final value:

    "llm_step_1": "{\"sum\":5}"

## Why this matters

This demo shows that the professional planner prompt layer is not just documented or unit tested.

It is reachable through the real HTTP agent runtime.

It preserves the old deterministic plan path while adding a new explicit verified planner prompt path.

## Related tests

    tests/http.agent-run.llm-live.verified-planner-prompt.test.js
    tests/agent-run/llm-live-verified-planner-input-mode.test.ts
    tests/agent-run/llm-live-planner-bridge.test.ts
    tests/agent-run/llm-live-planner-contract.test.ts

## Related docs

    docs/deterministic-planner-prompt-v1.1.md
    docs/llm-live-planner-contract-boundary.md
    docs/llm-live-verified-planner-bridge.md
    docs/llm-live-verified-planner-input-mode.md