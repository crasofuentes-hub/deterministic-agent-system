# Deterministic Planner Prompt v1.1

Prompt contract:

    planner.deterministic@1.1.0

This version strengthens the planner prompt without changing the planner output schema.

## Why v1.1 exists

Version 1.0 established the prompt contract, output schema, registry, and verifier.

Version 1.1 improves the actual prompt quality with:

- stronger role definition
- stronger runtime/audit framing
- explicit mission block
- non-negotiable planning rules
- tool selection policy
- clarification policy
- full JSON few-shot examples
- private final self-check
- visible documentation of the real prompt structure

## Important policy

The prompt instructs the model to reason privately.

It does not ask the model to expose chain-of-thought.

The auditable output fields remain:

    decisionSummary
    assumptions
    missingInputs
    steps

This preserves auditability without storing hidden reasoning.

## Prompt sections

The rendered prompt includes:

    <role>
    <mission>
    <non_negotiable_rules>
    <tool_selection_policy>
    <clarification_policy>
    <output_contract>
    <few_shot_examples>
    <private_final_self_check>
    <available_tools>

## Few-shot examples

Version 1.1 includes complete JSON examples for:

- executable single-step plan
- clarification-required response
- executable multi-step plan with dependsOn

## Output schema

The output schema remains compatible with:

    DeterministicPlannerOutputV1

This means v1.1 can use the same validator and verifier as v1.0.

## Implementation

    src/prompts/planner/planner-contract-v1-1.ts

## Tests

    tests/prompts/planner-prompt-v1-1.test.ts

The tests verify:

- strong prompt sections are rendered
- full few-shot examples are visible
- private self-check exists
- chain-of-thought is not exposed
- v1.0 and v1.1 can coexist in the registry
- output validation remains compatible