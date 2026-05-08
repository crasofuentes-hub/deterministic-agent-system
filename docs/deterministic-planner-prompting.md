# Deterministic Planner Prompting

The deterministic planner prompting layer defines how LLM-produced plans are constrained, validated, and rejected before execution.

This is not a free-form prompt layer. It is a versioned contract layer.

## Current status

Implemented:

- Versioned prompt contract abstraction.
- Prompt registry with duplicate id/version protection.
- Deterministic planner prompt contract.
- Planner output validation.
- Hidden reasoning field rejection.
- Allowed tool validation.
- Step ordering validation.
- Dependency validation.
- Deterministic plan verifier.
- Basic JSON-schema-style parameter validation for tool inputs.
- Contractual tests for prompt contract and verifier.

## Implementation files

    src/prompts/contracts.ts
    src/prompts/registry.ts
    src/prompts/planner/planner-contract.ts
    src/prompts/index.ts
    src/planner/plan-verifier.ts
    src/planner/index.ts

## Tests

    tests/prompts/planner-prompt-contract.test.ts
    tests/planner/deterministic-plan-verifier.test.ts

## Planner prompt contract

Prompt id:

    planner.deterministic

Prompt version:

    1.0.0

Output schema name:

    DeterministicPlannerOutputV1

The rendered prompt requires JSON-only output and forbids hidden reasoning or chain-of-thought.

Instead of requesting free-form reasoning, the output uses:

    decisionSummary
    assumptions
    missingInputs

This keeps the planner auditable without depending on hidden model reasoning.

## Planner output shape

The planner output contract includes:

    decisionSummary
    requiresClarification
    clarificationQuestion
    assumptions
    missingInputs
    steps

Each step includes:

    step
    tool
    parameters
    explanation
    dependsOn

## Clarification behavior

If critical information is missing, the planner must return:

    requiresClarification: true
    clarificationQuestion: <non-empty question>
    steps: []

If the plan is executable, it must return:

    requiresClarification: false
    clarificationQuestion: null
    steps: [ ... ]

## Tool boundary

The planner may only use tools declared in the provided tool surface.

Invented tools are rejected.

The verifier checks tool names against the normalized available tool list.

## Parameter validation

The deterministic plan verifier validates tool parameters against the provided tool parameter schema.

Currently covered:

- required object properties
- primitive types
- enum values
- additionalProperties: false
- unknown parameter rejection

This is intentionally conservative and deterministic.

## Dependency validation

The verifier rejects invalid dependencies.

Rules:

- dependsOn may only reference prior step numbers.
- dependsOn must not contain duplicates.
- step numbers must start at 1 and increment by 1.

## Failure model

The verifier returns deterministic issue codes:

    PLAN_SCHEMA_INVALID
    PLAN_REQUIRES_CLARIFICATION
    PLAN_TOOL_NOT_ALLOWED
    PLAN_TOOL_PARAMETERS_INVALID
    PLAN_DEPENDENCY_INVALID

These codes are designed for future integration with LLM-live planner hardening.

## Current boundary

This layer defines and verifies planner contracts.

It does not yet route live LLM planner output through the verifier.

That should be implemented as a separate integration step.

## Recommended next integration

Next technical step:

    feat(llm-live): validate planner output through prompt contract and verifier

Expected flow:

    LLM output
    parse JSON
    validate planner prompt output
    verify deterministic plan
    reject invalid plan deterministically
    execute only verified plans

## LLM-live boundary

The LLM-live planner contract boundary validates planner-style LLM output before it is bridged into deterministic agent plans.

See:

    docs/llm-live-planner-contract-boundary.md

Current implementation:

    src/agent-run/llm-live-planner-contract.ts

Current tests:

    tests/agent-run/llm-live-planner-contract.test.ts
