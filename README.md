# Deterministic Agent System

## Quick Start: v0.5.0 Local Enterprise Operations

This release focuses on local enterprise-style operation of a supervised deterministic agent runtime.

Core operational features:

- Readiness endpoint: GET /ready.
- Protected metrics endpoint: GET /metrics.
- WhatsApp live pilot with signed webhook validation.
- SQLite-backed sessions, evidence, events, and handoffs.
- Handoff list and close operations.
- SQLite backup with SHA-256 manifest.
- Operational snapshot and pending handoff alert scripts.
- Local CLI wrapper through npm run cli.

Build and verify:

    Set-Location "C:\repos\deterministic-agent-system"

    npm install
    npm run build
    npm run test:baseline:contractual

Run local CLI help:

    npm run cli -- help

Run the live pilot smoke after configuring scripts/live-pilot.env.ps1:

    . .\scripts\live-pilot.env.ps1
    npm run cli -- smoke

Create an operational snapshot:

    . .\scripts\live-pilot.env.ps1
    npm run cli -- snapshot -SkipBackup

Current release:

    v0.5.0 - Local Enterprise Operations


A deterministic, auditable, and replayable autonomous agent system for controlled execution, bounded behavior, and verifiable outcomes.

This repository is centered on one primary objective: **building a deterministic agent system**. Internal execution layers, adapters, and validation tooling exist to support that objective, but they are implementation details rather than the identity of the project.

This project is intentionally engineered for environments where correctness, traceability, and reproducibility matter more than superficial demonstrations.

---

## Table of Contents

- Executive Summary
- Why This System Exists
- What Makes This Agent Different
- What Deterministic Means Here
- Project Scope and Non-Goals
- System Design Principles
- Operational Guarantees and Boundaries
- Current Development Status
- Stable Insurance Brokerage Slice (v0.4.0)
- Repository Structure
- Quickstart (Windows PowerShell + TypeScript)
- High-Level Architecture
- Execution Model
- State Transitions and Traceability
- Convergence and Bounded Behavior
- Adapter and Environment Integration
- Interface Contract Hardening Direction
- Deterministic Error Semantics
- Verification and Replay Strategy
- Testing Strategy
- Security, Trust Boundaries, and Safety Posture
- Observability and Auditability
- Roadmap
- Contribution Guidelines
- License
- Author

---

## Executive Summary

This repository is building a **deterministic autonomous agent system** intended for serious engineering and operational use.

The system is designed to support:

- Controlled execution sequencing
- Explicit state transitions
- Bounded autonomous behavior
- Auditable traces
- Replayable verification workflows
- Stable, machine-parseable error semantics
- Reproducible validation pipelines across environments

In practical terms, this project is not optimizing for "agent demos" that look impressive but cannot be inspected. It is optimizing for a system that can be understood, validated, and trusted under scrutiny.

---

## Why This System Exists

Many autonomous agent implementations fail when moved from demonstration environments to real workflows. The failure is often not in the idea of autonomy itself, but in the lack of engineering discipline around execution behavior.

Common failure patterns include:

- Hidden state mutation
- Opaque orchestration
- Inconsistent responses across environments
- Unbounded loops
- Weak error semantics
- Poor audit trails
- Inability to replay or verify behavior
- Runtime integration drift that breaks reliability over time

This project exists to directly address those weaknesses by designing the agent system around explicit contracts, controlled execution, and verifiable outcomes.

The goal is not merely to automate tasks. The goal is to build automation that remains inspectable and operationally defensible.

---

## What Makes This Agent Different

This project treats the agent as a **system with contracts**, not a vague autonomous process.

The design emphasizes:

- Contract-driven execution behavior
- Explicit state transition boundaries
- Bounded iteration and convergence checks
- Structured verification
- Stable interface and error semantics
- Auditability as a first-class concern

### Key differentiators

1. **Deterministic orchestration under declared conditions**  
   Execution is intended to be reproducible when the system is run under controlled inputs, configuration, and adapter behavior.

2. **Auditability-first architecture**  
   Traceability is designed into the execution flow, not added later as logging noise.

3. **Replayable validation workflows**  
   Verification is treated as a system capability, not a manual debugging improvisation.

4. **Bounded behavior and convergence controls**  
   Autonomous behavior is constrained by explicit stopping rules and convergence logic.

5. **Structured operational evidence**  
   Validation scripts, smoke tests, and status artifacts are part of the engineering process.

This approach is especially useful in technical, enterprise, and research contexts where explainability and repeatability are required.

---

## What Deterministic Means Here

The term "deterministic" is frequently used too loosely. In this repository it has a more operational meaning.

Determinism here means:

> Under declared and controlled conditions, the system can be executed in a way that produces reproducible behavior and verifiable outcomes.

### Deterministic conditions (conceptual)

A run is considered deterministically reproducible only when the following are controlled and declared:

- Canonicalized input representation
- Declared execution configuration
- Stable adapter behavior (real or mocked)
- Explicit state transition rules
- Stable interface contracts
- Trace generation and verification rules

### What deterministic does not mean

- It does **not** mean all external systems become deterministic by default.
- It does **not** mean uncertainty disappears.
- It does **not** mean every deployment environment behaves identically without control.

Instead, the system treats nondeterminism as something to detect, constrain, normalize, mock, or surface explicitly as a contract violation.

That distinction is central to the design philosophy.

---

## Project Scope and Non-Goals

### Scope

This repository is focused on building a deterministic agent system with:

- Controlled execution behavior
- Traceable decision and action flow
- Interface contracts
- Verification tooling
- Replay-oriented debugging and validation
- Reproducible operational workflows

### Non-Goals

This repository is not focused on:

- Unbounded autonomy without explicit stop conditions
- Opaque orchestration that cannot be audited
- Marketing-first "agent" claims without system guarantees
- Treating implementation infrastructure as the product identity
- Hiding integration drift behind convenience abstractions

The engineering objective is correctness and reliability, not theatrical complexity.

---

## System Design Principles

### 1) Explicit execution over implicit behavior

Execution flow should be understandable from outside the system. Hidden transitions create operational risk and make validation difficult.

### 2) Auditability is a first-class requirement

If the result cannot be traced and reviewed, it cannot be trusted for serious workflows.

### 3) Replayability over anecdotal success

A system that works once is less valuable than a system that can be rerun and verified.

### 4) Bounded autonomous behavior

The agent must operate within explicit stopping conditions, convergence checks, or externally enforced limits.

### 5) Stable contract semantics

Interfaces should expose consistent response shapes, error semantics, and machine-parseable outputs.

### 6) Integration boundaries are real

External tools, adapters, and interfaces are contract boundaries and must be treated as such.

### 7) Implementation details support the system, not the narrative

Internal codenames or execution layers may exist during development, but the documentation remains focused on the deterministic agent system itself.

---

## Operational Guarantees and Boundaries

This project is designed to move toward explicit guarantees. The exact guarantees will evolve as implementation matures, but the intended categories are clear.

### Intended guarantees (direction)

- Reproducible execution under declared conditions
- Traceable execution steps
- Stable error representation
- Bounded iteration behavior
- Scriptable verification workflows

### Explicit boundaries

The system can only guarantee behavior that remains within the declared execution contract.

Examples of boundary violations include:

- Unstable adapter outputs
- Hidden side effects
- Undeclared runtime differences
- Interface contract drift
- Nondeterministic external responses that are not normalized or mocked

When boundary violations occur, the correct system behavior is to surface the problem rather than hide it.

---

## Current Development Status
### v0.4.0 stable slice update

The repository now includes a verified stable business slice for **Northwind Insurance Brokers** in addition to the broader deterministic agent platform work.

This stabilized slice currently covers:

- insurance coverage information
- premium / price lookup
- broker-style eligibility guidance
- request / application status
- policy document delivery guidance
- premium adjustment guidance
- policy change / endorsement guidance
- deterministic human handoff
- deterministic WhatsApp channel mapping

Current verified stable baseline:

- **20 test files**
- **130 tests**
- **0 failures**


### Implemented and verified (current main)

The following capabilities are implemented in code and covered by automated tests in this repository:

- **HTTP agent execution interface:** `POST /agent/run`
  - Supports planners: `deterministic`, `mock`, `det-tools`, `det-replan`, `det-replan2`, `llm-mock`, and `llm-live`
- **Deterministic planners and bounded execution**
  - Stable plan canonicalization
  - Stable plan / execution / final trace link hashes
  - Bounded execution with explicit `maxSteps`
- **Bounded deterministic tool-loop**
  - `planner = det-tools`
  - Deterministic loop termination via fixpoint or bounded iteration
  - Built-in deterministic tools including `echo` and `math/add`
- **Replay and determinism verification**
  - Replay bundle generation and replay verification
  - Determinism snapshot validation
  - Canonical-equivalent plans now hash and execute consistently
- **Run registry and lifecycle hardening**
  - Create / get / start / execute / complete / fail / cancel transitions
  - Deterministic invalid-transition handling
  - Persisted cancellation semantics and terminal-state protection
- **LLM-oriented planning paths**
  - `llm-mock` planner for deterministic model-style planning tests
  - `llm-live` planner with canonical cache-backed materialization
  - `llm-live` supports:
    - deterministic mock provider path
    - deterministic `openai-compatible` stub path via `llmPlanText`
    - async planner path for real `openai-compatible` adapter usage
- **Async planner support**
  - `runAgent()` can resolve either synchronous planners or planners exposing `planAsync()`
- **Deterministic demo and validation scripts**
  - triplicate live demo
  - replay verification demo
  - real-path `llm-live` demo with visible hashes

### Evidence (representative tests)

- `tests/agent.executor.test.js`
- `tests/agent.determinism.snapshot.test.js`
- `tests/agent.replay.e2e.test.js`
- `tests/http.agent-run.llm-live.test.js`
- `tests/http.agent-run.llm-live.openai-compatible.stub.test.js`
- `tests/planner.llm-live.parse.test.js`
- `tests/planner.llm-live.real-adapter.test.js`
- `tests/agent-run.async-planner.test.js`
- `tests/http.runs.*.test.js`

This repository is under active development, but it has moved beyond pure execution scaffolding: it now includes deterministic agent execution, hardened run lifecycle behavior, replay verification, and an async-capable `llm-live` planning path that can be materialized through cache, stubbed model text, or an injected real adapter.

### Current implementation emphasis (high level)

- Deterministic execution substrate and traceability
- Replay, snapshot, and cache-backed reproducibility
- Hardened run lifecycle and contract behavior
- Async-capable LLM plan materialization
- Controlled adapter integration for real-provider planning
- Verification tooling and reproducible demos

### `llm-live` real-path usage

The repository now supports a controlled async planning path for `planner = llm-live` with `llmProvider = openai-compatible`.

#### Environment variables

- `DAS_OPENAI_COMPAT_BASE_URL`
- `DAS_OPENAI_COMPAT_API_KEY`
- `DAS_OPENAI_COMPAT_MODEL`

#### Optional deterministic stub override

- `DAS_LLM_PLAN_TEXT`

When `DAS_LLM_PLAN_TEXT` is provided, the system can materialize a deterministic plan from explicit model text without requiring a live provider call. This is useful for contract verification, deterministic demos, and reproducible local validation.

#### Demo

Build the project and run:

    npm run demo:agent:llm-live:real

#### Expected behavior

- With `DAS_LLM_PLAN_TEXT`, the demo uses the deterministic stub path.
- Without `DAS_LLM_PLAN_TEXT`, and with valid provider environment variables, the async real-provider path is used.
- Without stub text and without provider configuration, the system fails through the current deterministic error envelope for the unconfigured real path.

The intent of this path is controlled materialization of plans, not unconstrained autonomous generation. Deterministic caching, validation, and contract checks remain part of the design.

## Roadmap Snapshot

| Status | Area | Notes |
|---|---|---|
| Done | Deterministic execution core | Canonical plans, bounded execution, stable plan/execution/trace hashes |
| Done | Replay and determinism verification | Replay bundle, replay verification, determinism snapshot coverage |
| Done | Run lifecycle hardening | Create/get/start/execute/complete/fail/cancel transitions with deterministic behavior |
| Done | `llm-live` stub + async real-path support | Mock path, deterministic stub path, async planner support for real provider integration |
| Done | Live contract verification | `verify:contracts` checks live `/agent/run`, repeated determinism, hash prefixes, and unconfigured real-path error envelope |
| In Progress | Real-provider path hardening | Tightening real `openai-compatible` path behavior, validation, and operational evidence |
| In Progress | README / usage clarity | Making live-path usage, demos, and expected behavior more explicit |
| Next | Provider-backed `llm-live` demo workflow | End-to-end documented flow using real provider configuration |
| Next | Stronger contract assertions | Expand verification beyond minimum shape into more semantic result guarantees |
| Next | Additional deterministic tools | Increase practical agent value while keeping bounded and verifiable behavior |

## Stable Insurance Brokerage Slice (v0.4.0)

The repository now includes a stabilized domain slice for **Northwind Insurance Brokers**.

### Deterministic payment-audit vertical

The most concrete enterprise-facing vertical currently implemented in this repository is:

- **`customer-service-payment-audit-v1`**

This vertical demonstrates how the deterministic runtime can support a realistic insurance servicing and payment-audit workflow while preserving:

- explicit business context selection
- deterministic entity extraction
- canonical response families
- reproducible multi-turn behavior
- deterministic dataset-backed answers
- stable tests for API, session, WhatsApp bridge, and semantic invariants

### What this vertical currently supports

The `payment-audit` slice currently supports deterministic handling for:

- payment status lookup by `paymentId`
- payment history lookup by `policyId`
- payment history lookup by `customerId`
- payment discrepancy review by `paymentId`
- payment discrepancy review by discrepancy type
- policy billing status lookup by `policyId`
- policy servicing guidance by `policyId + billingTopic`
- deterministic billing-specialist handoff

### Dataset-backed behavior

Unlike placeholder-only demos, this slice is already backed by a deterministic local repository:

- `data/payment-audit-records.json`
- `src/data-layer/payment-audit-repository.ts`

The current dataset includes:

- multiple payment records per policy
- multiple payment records per customer
- multiple discrepancy cases of the same type
- stable billing states such as `current`, `review-required`, and `delinquent`
- servicing topics such as `document-delivery`, `refund-timing`, `premium-adjustment`, and `endorsement`

### Reproducible demo

Build the project and run:

    npm run build
    npm run demo:payment-audit

This demo prints deterministic results for:

- payment status
- payment history by policy
- policy servicing
- payment discrepancy review
- payment history by customer

Representative example prompts already covered by the demo:

- `What is the status of payment PMT-1001?`
- `Show me the payment history for policy POL-900`
- `I need help with refund timing for policy POL-901`
- `I need help with a duplicate charge`
- `Show me the payment history for customer CUS-101`

### Target operational value

This vertical is intended as a realistic stepping stone toward insurance-service workflows where reproducibility and auditability matter, including:

- payment servicing review
- discrepancy escalation support
- billing-state verification
- broker / billing specialist handoff
- deterministic customer-service flows over API and messaging channels

It is not yet presented as a full production insurance platform, but it is already a concrete, reproducible, test-backed vertical rather than a generic agent demo.


This slice demonstrates how the deterministic agent architecture can support a realistic service workflow without abandoning bounded behavior, canonical responses, or verification rigor.

### Current supported broker-style interactions

- coverage information lookup
- premium / price lookup
- eligibility / availability guidance
- broker review and underwriting review guidance
- request / application status lookup
- policy document delivery guidance
- premium adjustment guidance
- policy change / endorsement guidance
- deterministic handoff to a licensed broker specialist
- deterministic WhatsApp channel output mapping

### Representative example questions

- `What is the estimated premium for Personal Auto Standard?`
- `Is General Liability Core eligible?`
- `What is the status of my application ORDER-55555?`
- `When will my policy documents be issued?`
- `How do I request a premium adjustment?`
- `How do I request a policy change?`
- `I want to speak with a broker.`

### Verified stable baseline

- **20 test files**
- **130 tests**
- **0 failures**

### Release alignment

- **`v0.4.0 - Insurance brokerage domain specialization and broker eligibility hardening**

---
## Repository Structure

The repository is organized to separate implementation, scripts, documentation, and testing concerns.

    deterministic-agent-system/
    |-- .github/
    |   -- workflows/
    |-- docs/
    |   -- architecture.md
    |-- scripts/
    |-- src/
    |   -- index.ts
    |-- tests/
    |-- .gitignore
    |-- LICENSE
    |-- README.md
    |-- package.json
    -- tsconfig.json

As the system evolves, this layout will expand to include:

- Agent execution modules
- Integration adapters
- Contract definitions and validators
- Trace tooling
- Replay utilities
- Verification scripts and status artifacts
- Integration and negative-path smoke tests

---

## Quickstart (Windows PowerShell + TypeScript)

### Prerequisites

- Windows PowerShell 5.1
- Git
- Node.js + npm

### 1) Install dependencies

    npm install

### 2) Build

    npm run build

### 3) Verify (tests that define the current contract)

    node --test tests/http.negative.test.js
    node --test tests/http.agent-run.test.js
    node --test tests/http.agent-run.tools.test.js
    node --test tests/http.agent-run.tools.loop.test.js
    node --test tests/http.tools.test.js
    node --test tests/http.agent.capabilities.test.js

### Try it now (one-command demos)

    npm run build
    npm run demo:tools
    npm run demo:capabilities
    npm run demo:agent:llm-mock
    npm run demo:agent:tool-loop
    npm run demo:replay:verify

### `llm-live` real-path demo (PowerShell)

#### A) Deterministic stub path

This path uses explicit model text and does not require a live provider call.

    $env:DAS_LLM_PLAN_TEXT = '{"planId":"demo-llm-live-stub-v1","version":1,"steps":[{"id":"d","kind":"tool.call","toolId":"math/add","input":{"a":2,"b":3},"outputKey":"sum"},{"id":"b","kind":"set","key":"intent","value":"compute"},{"id":"a","kind":"set","key":"goal","value":"sum 2 3"},{"id":"c","kind":"append_log","value":"llm-live:planned"},{"id":"e","kind":"append_log","value":"done"}]}'
    npm run demo:agent:llm-live:real
    Remove-Item Env:DAS_LLM_PLAN_TEXT

Expected behavior:
- `pathUsed = "stub"`
- deterministic hashes are shown
- no external provider call is required

#### B) Real provider path

    $env:DAS_OPENAI_COMPAT_BASE_URL = "https://your-provider.example/v1"
    $env:DAS_OPENAI_COMPAT_API_KEY = "your-api-key"
    $env:DAS_OPENAI_COMPAT_MODEL = "your-model-id"
    npm run demo:agent:llm-live:real

Expected behavior:
- `pathUsed = "real-provider"`
- the provider is asked for plan materialization
- the resulting plan is canonicalized before execution

#### C) Real path without configuration

    Remove-Item Env:DAS_LLM_PLAN_TEXT -ErrorAction SilentlyContinue
    Remove-Item Env:DAS_OPENAI_COMPAT_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DAS_OPENAI_COMPAT_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:DAS_OPENAI_COMPAT_MODEL -ErrorAction SilentlyContinue
    npm run demo:agent:llm-live:real

Expected behavior:
- the demo reports `pathUsed = "real-provider"`
- the request fails through the current deterministic error envelope
- the summary prints HTTP status, error code, and error message


### 4) Run the HTTP server (manual try)

In one terminal:

    node dist/src/http/server.js

Then in another terminal:

    curl http://127.0.0.1:3000/tools
    curl http://127.0.0.1:3000/agent/capabilities

Agent run (det-tools):

    curl -X POST http://127.0.0.1:3000/agent/run ^
      -H "content-type: application/json" ^
      -d "{""goal"":""add 2 3"",""demo"":""core"",""mode"":""mock"",""planner"":""det-tools"",""maxSteps"":8}"

Loop demo (fixpoint inside tool.loop):

    curl -X POST http://127.0.0.1:3000/agent/run ^
      -H "content-type: application/json" ^
      -d "{""goal"":""loop add 1 2"",""demo"":""core"",""mode"":""mock"",""planner"":""det-tools"",""maxSteps"":12}"

Notes:
- All results include deterministic hashes (planHash / executionHash / finalTraceLinkHash) when inputs and mode are controlled.
- tool.loop convergence is based on a fixpoint check over the core state (values + counters), ignoring logs.


## High-Level Architecture

The architecture is centered on the deterministic agent system and supported by execution, integration, and validation layers.

    +------------------------------------------------------------------+
    |                    Deterministic Agent System                    |
    |  Planning, action selection, bounded iteration, policy control   |
    +------------------------------+-----------------------------------+
                                   |
                                   v
    +------------------------------------------------------------------+
    |           Deterministic Execution and Control Layer              |
    |  Execution sequencing, transition control, convergence checks,   |
    |  trace emission, validation checkpoints                          |
    +------------------------------+-----------------------------------+
                                   |
                                   v
    +------------------------------------------------------------------+
    |             Adapter and Environment Integration Layer            |
    |  Local execution, mock execution, external tool/interface modes  |
    +------------------------------+-----------------------------------+
                                   |
                                   v
    +------------------------------------------------------------------+
    |        Verification, Replay, Audit, and Status Artifacts         |
    |  Smoke tests, scripted validation, traces, status documents      |
    +------------------------------------------------------------------+

### Architectural intent

The top layer (the deterministic agent) is the behavioral focus and product identity.

The supporting layers exist to:

- enforce execution rules,
- constrain integration behavior,
- generate auditable evidence,
- and support reproducible validation.

---

## Execution Model

The execution model is being designed to support deterministic behavior through explicit sequencing and bounded control.

### Core execution concerns

- Input normalization and canonicalization
- Deterministic step sequencing
- Controlled state transition boundaries
- Convergence and termination checks
- Structured trace generation
- Validation checkpoints

### Conceptual execution lifecycle

1. Receive or construct a normalized input representation
2. Select execution mode and declared configuration
3. Execute bounded agent steps through controlled pathways
4. Emit trace records and intermediate validation evidence
5. Evaluate convergence or stopping conditions
6. Produce final output or structured failure result
7. Persist or expose status evidence for verification and audit

This lifecycle is designed to make execution inspectable and testable rather than opaque.

---

## State Transitions and Traceability

A deterministic agent system must make state transitions visible enough to be inspected and validated.

### Why this matters

Without explicit transition visibility, it becomes difficult to answer core engineering questions:

- What changed?
- Why did it change?
- Was the change valid?
- Can the same transition be replayed?
- Did a contract boundary produce invalid behavior?

### Traceability design direction

The system is being built to support trace records usable for:

- Operational review
- Failure analysis
- Regression investigation
- Replay validation
- Determinism checks across runs

Trace design is treated as structural architecture, not optional logging.

---

## Convergence and Bounded Behavior

Autonomous systems often fail when they can iterate without well-defined boundaries.

This project treats bounded behavior as a core requirement.

### Bounded behavior principles

- Explicit stop conditions
- Convergence checks where applicable
- Iteration limits
- Failure escalation when convergence cannot be established
- Structured outputs for non-convergent outcomes

### Why bounded behavior matters

Bounded behavior improves:

- Reliability
- Debuggability
- Runtime cost predictability
- Safety posture
- Operational trust

In this repository, "autonomous" does not mean "unbounded."

---

## Adapter and Environment Integration

A deterministic agent system depends heavily on the behavior of its integration layer.

Adapters and interfaces are treated as explicit contract boundaries.

### Integration concerns

- Local execution behavior
- Mock execution for verification and testing
- External interface normalization
- Error contract consistency
- Side-effect isolation or declaration

### Design intention

The system should be able to:

- validate adapter behavior under controlled test conditions,
- compare behavior across execution modes,
- detect contract drift early,
- and prevent unstable integrations from silently corrupting agent behavior.

This is one reason verification workflows and smoke tests are emphasized early.

---

## Interface Contract Hardening Direction

Where interface layers (including HTTP interfaces) are used, they must behave deterministically enough to support reproducible automation and verification.

This includes success and failure behavior.

### Contract hardening direction

- Explicit response schemas
- Stable field names
- Consistent status semantics
- Predictable error payload structure
- Negative-path validation
- Cross-mode consistency checks (for example, local vs mock under comparable conditions)

Interface quality is a core part of deterministic system quality.

---

## Deterministic Error Semantics

Error handling is often where deterministic behavior breaks first. This repository treats error semantics as an explicit design surface that must be hardened.

### Target properties for error outputs

- Machine-parseable structure
- Stable error code values
- Explicit retryability semantics
- Minimal ambiguity in human-readable messages
- Consistent metadata shape across execution modes

### Why this matters

Stable error semantics improve:

- Automated testing
- Retry logic
- Operational diagnostics
- Cross-environment consistency
- Failure-case auditability

A deterministic agent system must be deterministic in failure handling, not only in successful paths.

---

## Verification and Replay Strategy

Verification is not a final phase performed after "feature completion." It is part of the architecture.

### Verification strategy (design direction)

- Scripted validation commands
- Smoke tests for critical paths
- Mode-specific and cross-mode checks
- Status artifact generation
- Replay-oriented trace inspection
- Regression validation after contract changes

### Replay strategy (design direction)

The system is intended to support replay-oriented debugging and validation so that observed behavior can be investigated and compared under controlled conditions.

Replay transforms debugging from guesswork into evidence-based analysis.

---

## Testing Strategy

The testing approach is designed to evolve in layers aligned with system maturity.

### Layer 1: Build and bootstrap validation

- Dependency installation
- TypeScript compilation
- Entrypoint execution

### Layer 2: Component and unit testing

- Deterministic utility logic
- Contract validation helpers
- Canonicalization and normalization logic
- Error payload formatting

### Layer 3: Integration and smoke testing

- Local execution pathways
- Mock execution pathways
- Interface behavior under valid and invalid inputs
- Cross-mode consistency checks

### Layer 4: Verification workflow testing

- Script execution validation
- Status artifact generation
- Replay and trace inspection tooling
- Determinism regression checks

This layered strategy supports incremental progress without sacrificing rigor.

---

## Security, Trust Boundaries, and Safety Posture

The system is designed with the assumption that external inputs and integrations are untrusted unless explicitly validated.

### Trust boundary principles

- External inputs are not trusted by default
- Adapter outputs must conform to declared contracts
- Side effects should be explicit, bounded, and reviewable
- Failures should surface clearly rather than being hidden

### Security posture (development direction)

- Contract validation at integration boundaries
- Explicit failure semantics
- Traceable operational events
- Controlled execution pathways
- Hardening before expansion of capabilities

This repository prioritizes engineering discipline over premature feature breadth.

---

## Observability and Auditability

A deterministic agent system must provide enough operational evidence for human review and automated validation.

### Observability goals

- Clear execution state visibility
- Structured outputs and status artifacts
- Machine-parseable validation signals
- Reproducible command-based checks

### Auditability goals

- Traceable execution flow
- Inspectable failures
- Reconstructable behavior under declared conditions
- Documentation of operational assumptions and limits

In practical terms, the system should allow an engineer to answer:

- What happened?
- Why did it happen?
- Can it be replayed?
- Was it valid under the declared contract?

---

## Roadmap

### Near-term priorities

1. Integrate deterministic agent behavior on top of the current execution foundation
2. Harden interface contracts, including deterministic error payloads
3. Expand negative-path smoke testing
4. Improve replay and trace validation tooling
5. Strengthen documentation of invariants and operational guarantees

### Mid-term priorities

- Formalize execution invariants
- Expand contract conformance testing
- Improve bounded behavior controls
- Strengthen verification automation and status artifact quality
- Improve cross-environment consistency checks

### Long-term direction

A production-grade deterministic autonomous agent system with explicit operational guarantees, strong auditability, structured verification workflows, and reproducible execution behavior.

---

## Contribution Guidelines

Contributions are welcome, especially those that improve determinism, verification quality, auditability, and execution correctness.

### High-value contribution areas

- Deterministic execution controls
- Contract validation and schema hardening
- Verification and replay tooling
- Testing infrastructure
- Documentation clarity and precision
- Observability and trace tooling

### Contribution expectations

- Prefer explicit behavior over implicit behavior
- Document assumptions clearly
- Preserve reproducibility where possible
- Add tests or verification coverage for new execution paths
- Avoid abstractions that hide contract boundaries

The standard for this repository is engineering clarity.

---

## License

This project is licensed under the Apache License 2.0.

See the LICENSE file for details.

---

## Author

**Oscar Fuentes Fernandez**

Independent builder focused on deterministic systems, auditable artificial intelligence execution, bounded autonomous behavior, reproducible verification workflows, and enterprise-grade engineering rigor.
