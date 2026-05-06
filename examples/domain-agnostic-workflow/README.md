# Domain-Agnostic Deterministic Workflow

This example shows the framework without insurance, brokerage, payment, or customer-service assumptions.

It demonstrates deterministic agent execution using generic goals, mock planners, tool loops, and replay-safe outputs.

## Prerequisites

From the repository root:

    Set-Location "C:\repos\deterministic-agent-system"
    npm install
    npm run build

## Run a mock LLM planner demo

    npm run demo:agent:llm-mock

Expected behavior:

- starts the local HTTP server on an ephemeral port
- sends a generic goal such as sum 2 3
- uses the mock planner
- returns deterministic agent output
- closes the server

## Run a deterministic tool-loop demo

    npm run demo:agent:tool-loop

Expected behavior:

- runs a generic tool-loop goal
- executes bounded deterministic steps
- returns stable output suitable for replay and regression checks

## Verify replay behavior

    npm run demo:replay:verify

Expected behavior:

- creates a replay bundle
- verifies deterministic replay behavior
- keeps the workflow independent from any business vertical

## Validate the contractual baseline

    npm run test:baseline:contractual

Current expected baseline:

    31 test files
    268 tests

## Why this example exists

The repository includes an insurance brokerage vertical, but the framework itself is domain-agnostic.

This example gives new users a clean starting point for deterministic execution without needing to understand the insurance vertical first.
