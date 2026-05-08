# LLM Live Planner Contract Boundary

The LLM-live planner contract boundary validates planner-style LLM output before it can be treated as a deterministic planning artifact.

This is a defensive boundary. It does not yet replace the existing `DeterministicAgentPlan` parser used by `planner-llm-live.ts`.

## Current status

Implemented:

- Verified LLM-live planner prompt output boundary.
- Deterministic JSON parse failure mapping.
- Planner prompt contract validation.
- Deterministic plan verifier integration.
- Hidden reasoning rejection through prompt contract.
- Invented tool rejection through verifier.
- Deterministic error code for invalid planner contract output.
- Contractual tests for the boundary.

## Implementation files

    src/agent-run/llm-live-planner-contract.ts
    src/agent-run/index.ts

Related prompt/planner files:

    src/prompts/planner/planner-contract.ts
    src/planner/plan-verifier.ts

## Tests

    tests/agent-run/llm-live-planner-contract.test.ts
    tests/prompts/planner-prompt-contract.test.ts
    tests/planner/deterministic-plan-verifier.test.ts

## Validation flow

The boundary follows this flow:

    LLM text
    JSON.parse
    deterministicPlannerPromptContract.validateOutput(...)
    verifyDeterministicPlan(...)
    return verified output or deterministic error

## Success result

A successful result returns:

    ok: true
    plannerOutput
    executable
    normalizedToolNames

`plannerOutput` is the validated `PlannerPromptOutput`.

`executable` indicates whether the planner output is ready to execute or requires clarification.

`normalizedToolNames` records the deterministic allowed tool surface used by verification.

## Failure result

A failed result returns:

    ok: false
    error:
      code: LLM_LIVE_PLANNER_CONTRACT_INVALID
      message: <stable failure summary>
      retryable: false
      issues: [...]

The `issues` array contains deterministic verifier issues such as:

    PLAN_SCHEMA_INVALID
    PLAN_REQUIRES_CLARIFICATION
    PLAN_TOOL_NOT_ALLOWED
    PLAN_TOOL_PARAMETERS_INVALID
    PLAN_DEPENDENCY_INVALID

## JSON parse errors

Malformed JSON is mapped to:

    LLM_LIVE_PLANNER_CONTRACT_INVALID

with an issue:

    PLAN_SCHEMA_INVALID

and path:

    $

The message starts with:

    llm_live_planner_contract_invalid_json:

## Hidden reasoning rejection

The boundary rejects fields outside the planner contract.

For example, a model output containing:

    reasoning

is rejected because hidden reasoning is not part of the planner output contract.

The accepted audit field is:

    decisionSummary

## Invented tool rejection

The boundary rejects planner output that references tools outside the provided tool surface.

Example rejected tool:

    invented.tool

The detail is returned in:

    error.issues

## Boundary vs existing LLM-live deterministic plan parser

The existing LLM-live parser still accepts deterministic agent plans shaped as:

    planId
    version
    steps

That parser is still protected by existing LLM-live contractual tests.

The new boundary validates planner prompt output shaped as:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

These are separate contracts today.

## Next integration

The next technical step is to bridge verified planner prompt output into the existing deterministic agent plan format.

Recommended commit:

    feat(llm-live): bridge verified planner prompt output to deterministic plan

Expected future flow:

    LLM planner prompt output
    verified planner boundary
    deterministic bridge
    DeterministicAgentPlan
    canonicalizePlan
    executor

## Non-goals

This boundary does not yet:

- replace `parseDeterministicPlanFromModelText`
- execute planner prompt output directly
- call a live LLM provider
- infer tools not provided in the tool surface
- mutate the existing deterministic agent plan contract