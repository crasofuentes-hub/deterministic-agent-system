# Current Platform Capabilities

This document summarizes the current product-level capabilities of `deterministic-agent-system`.

The purpose is to make the repository reviewable without requiring an evaluator to reconstruct progress from commit history.

## Executive summary

`deterministic-agent-system` is no longer only a basic deterministic agent prototype.

It now includes:

- domain-agnostic core positioning
- vertical extension boundaries
- insurance brokerage vertical extension
- async task queue contract
- Postgres-oriented production storage work
- tamper-evident execution journal
- replay engine
- WhatsApp journal/replay ops endpoints
- replay override support
- replay integrity failure protection
- versioned planner prompt contracts
- deterministic planner verifier
- planner prompt v1.1 with stronger prompt structure
- LLM-live verified planner prompt boundary
- bridge from verified planner output to `DeterministicAgentPlan`
- explicit `planner-prompt-output` mode for `/agent/run`
- HTTP proof for verified planner prompt mode
- contractual baseline tests

## Deterministic core

The core runtime protects deterministic execution through:

- canonical plan validation
- canonical step ordering
- deterministic execution hashes
- trace/hash artifacts
- bounded execution behavior
- explicit planner contracts

Representative areas:

    src/agent
    src/agent-run
    src/core
    src/tools

## Vertical architecture

The project now separates core behavior from vertical-specific business logic.

The intended architecture is:

    core runtime
    domain extension contract
    registered verticals
    vertical-specific tools/context/extractors

Representative areas:

    src/verticals
    src/insurance
    tests/architecture

Implemented themes:

- domain extension contract
- insurance brokerage vertical extension
- vertical public boundary guard
- vertical extension boundary guard
- core vs vertical positioning docs

## Insurance brokerage vertical

The insurance work is positioned as a vertical extension, not as core runtime logic.

Representative capabilities:

- coverage lookup / coverage response formatting
- policy repository
- coverage query facade
- account manager alerts
- insurance brokerage domain extension

Representative tests:

    tests/insurance
    tests/architecture

## Journal and replay

The system includes tamper-evident journal and replay capabilities.

Implemented themes:

- tamper-evident execution journal
- Postgres execution journal adapter
- async WhatsApp journal integration
- journal ops endpoint
- replay ops endpoint
- bounded replay with `untilSequence`
- replay override support
- replay integrity failure rejection

Representative areas:

    src/journal
    src/replay
    src/http/handlers
    tests/http
    tests/replay

## Postgres production direction

Postgres is already used in production-oriented runtime paths.

Implemented themes:

- Postgres pool/config parsing
- Postgres migrations
- Postgres execution journal adapter
- Postgres WhatsApp async runtime preference/default tests
- Docker Postgres service for WhatsApp runtime
- storage docs for production WhatsApp runtime

Representative areas:

    src/storage
    src/journal
    docker-compose.yml
    tests/storage
    tests/channels

## Async task queue

The async task queue abstraction exists as a contract layer.

Implemented themes:

- queue job contract
- async queue interface
- inline-compatible architecture direction
- documentation for future adapters

Representative areas:

    src/queue
    docs

Remaining production work:

- route a real long-running runtime flow through the queue
- add external adapters later without changing core call sites

## LLM-live hardening

The LLM-live planner path has been significantly hardened.

Implemented pipeline:

    planner prompt v1.1
    prompt contract validation
    deterministic plan verifier
    LLM-live verified boundary
    bridge to DeterministicAgentPlan
    canonicalizePlan
    deterministic executor

Implemented themes:

- versioned prompt contract
- prompt registry
- planner prompt v1.1
- full prompt sections and few-shot examples
- hidden reasoning field rejection
- invented tool rejection
- required parameter validation
- dependency validation
- explicit verified planner input mode
- HTTP proof through `/agent/run`

Representative files:

    src/prompts
    src/planner
    src/agent-run/llm-live-planner-contract.ts
    src/agent-run/llm-live-planner-bridge.ts
    src/agent-run/planner-llm-live.ts
    tests/agent-run
    tests/http.agent-run.llm-live.verified-planner-prompt.test.js

## Verified planner HTTP flow

The verified planner mode is reachable through the real HTTP runtime.

Input mode:

    llmPlanTextFormat: "planner-prompt-output"

Default mode remains:

    deterministic-agent-plan

This preserves compatibility while allowing the stronger verified planner path.

Proof:

    node tests/http.agent-run.llm-live.verified-planner-prompt.test.js

## Contractual proof commands

Use these commands to verify the current platform surface:

    npm run build
    npm run test:llm-live:contractual
    npm run test:baseline:contractual

If the verified planner demo script exists in the repo, also run:

    npm run demo:agent:llm-live:verified-planner

## Remaining high-value hardening

Next recommended product work:

1. Add structured observability for verified planner events.
2. Record verified planner prompt metadata into the journal.
3. Consolidate global storage mode strategy.
4. Route one real flow through `InlineTaskQueue`.
5. Add richer prompt/tool metadata to agent run results.