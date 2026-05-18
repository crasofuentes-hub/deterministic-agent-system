# Current Red Flags Status

This document summarizes the current architectural review status for the main Red Flags.

## Summary

| Red Flag | Current Status | Evidence |
|---|---:|---|
| Vertical Insurance Decoupling | Mostly closed | Public boundary, vertical import guards, architecture tests |
| Postgres as Production Recommended | Strongly improved | StorageMode, runtime resolver, startup status tests |
| AsyncTaskQueue | Improved | Queue contract, InlineTaskQueue, runAgent queue wrapper |
| LLM-live Prompt Hardening | Strongly improved | Prompt v1.1, verifier, bridge, HTTP proof |
| LLM-live / Planner Observability | Strongly improved | Structured verified planner events and Journal sink |
| Journal / Replay | Strongly improved | Tamper-evident journal, replay override, integrity rejection |
| Repo visibility | Improved | Status docs and baseline evidence |

## 1. Vertical Insurance Decoupling

Status:

    Mostly closed.

Evidence:

    tests/architecture/core-vertical-import-audit.test.ts
    tests/architecture/vertical-public-boundary.test.ts
    tests/architecture/core-domain-boundary.test.ts
    src/insurance/index.ts
    src/verticals/insurance-brokerage

Current architecture:

    Core runtime modules must not import insurance vertical implementation directly.
    Application composition layers may use the public insurance boundary.
    Direct imports into src/verticals/insurance-brokerage are guarded.

Remaining work:

    Continue keeping future insurance-specific behavior behind public vertical boundaries.

## 2. Postgres as Production Recommended

Status:

    Strongly improved.

Evidence:

    src/storage/storage-mode.ts
    src/storage/runtime-storage-mode.ts
    src/http/storage-mode-startup.ts
    tests/storage/storage-mode.test.ts
    tests/storage/runtime-storage-mode.test.ts
    tests/http/storage-mode-startup.test.ts
    docs/storage-mode-strategy.md

Current behavior:

    StorageMode supports auto, memory, sqlite, and postgres.
    Local zero-config behavior remains sqlite-friendly.
    Production mode can require or recommend Postgres explicitly.
    Explicit postgres mode validates DATABASE_URL clearly.

Remaining work:

    Wire the global StorageMode resolver deeper into every runtime store factory path.

## 3. AsyncTaskQueue

Status:

    Improved.

Evidence:

    src/queue
    src/agent-run/run-queue.ts
    tests/queue/inline-task-queue.test.ts
    tests/agent-run/run-queue.test.ts

Implemented:

    AsyncTaskQueue contract.
    InlineAsyncTaskQueue.
    runAgentThroughQueue(...).
    runAgentThroughInlineTaskQueue(...).

Remaining work:

    Expose queued execution through a production runtime path or HTTP option.

Recommended next technical block:

    feat(http): add explicit queued agent run mode

## 4. LLM-live Prompt Hardening

Status:

    Strongly improved.

Evidence:

    src/prompts
    src/planner
    src/agent-run/llm-live-planner-contract.ts
    src/agent-run/llm-live-planner-bridge.ts
    src/agent-run/planner-llm-live.ts
    tests/prompts
    tests/planner
    tests/agent-run
    tests/http.agent-run.llm-live.verified-planner-prompt.test.js

Implemented:

    Versioned planner prompt contract.
    Planner prompt v1.1.
    Deterministic verifier.
    Verified planner prompt output boundary.
    Bridge from verified planner prompt output to DeterministicAgentPlan.
    HTTP proof through /agent/run.

Remaining work:

    Add a prompt version registry only when multiple prompt versions are active.

## 5. LLM-live / Planner Observability

Status:

    Strongly improved.

Evidence:

    src/agent-run/verified-planner-observability.ts
    src/journal/verified-planner-journal.ts
    src/journal/verified-planner-observability-journal.ts
    src/journal/verified-planner-journal-sink.ts
    src/journal/verified-planner-journal-sink-scope.ts
    src/http/handlers/agent-run-verified-planner-journal.ts
    tests/agent-run/llm-live-verified-planner-observability.test.ts
    tests/agent-run/verified-planner-observability-sink.test.ts
    tests/journal/verified-planner-journal.test.ts
    tests/journal/verified-planner-observability-journal.test.ts
    tests/journal/verified-planner-journal-sink.test.ts
    tests/http/agent-run-verified-planner-journal-sink.test.ts

Implemented structured events:

    llm_live.planner_prompt.received
    llm_live.planner_prompt.verified
    llm_live.planner_prompt.rejected
    llm_live.planner_bridge.created_plan

Implemented Journal event types:

    planner_prompt_received
    planner_prompt_verified
    planner_prompt_rejected
    planner_bridge_created_plan

Important correction:

    Explicit llmPlanText now materializes before cache lookup, ensuring verified planner observability is emitted for explicit planner prompt output instead of being bypassed by a cached plan.

Remaining work:

    Surface verified planner metadata in replay summaries or ops views.

## 6. Journal / Replay

Status:

    Strongly improved.

Evidence:

    src/journal
    src/replay
    tests/replay
    tests/http

Implemented:

    Tamper-evident execution journal.
    Postgres execution journal adapter.
    Replay engine.
    Replay ops endpoint.
    untilSequence support.
    replay override support.
    broken journal integrity rejection.

Remaining work:

    Correlate verified planner Journal events with replay summaries.

## Recommended Next Technical Step

Next high-value technical block:

    feat(http): add explicit queued agent run mode

Goal:

    Allow /agent/run to opt into InlineAsyncTaskQueue execution explicitly without changing the default runtime behavior.

Candidate request field:

    executionMode: "inline-queue"

Why:

    This closes the AsyncTaskQueue Red Flag from "contract plus direct wrapper" to "reachable from an actual HTTP runtime path."
## Tenant Security Update

Tenant ownership is now documented here:

    docs/tenant-security-model.md

Current tenant-related improvements include:

    - TenantContext foundation.
    - Tenant-aware /agent/run.
    - Tenant ownership in verified planner journal events.
    - Tenant ownership guard for replay.
    - Cross-tenant rejection for WhatsApp replay.
    - Cross-tenant rejection for WhatsApp journal reads.

Remaining gaps:

    - authentication,
    - authorization,
    - RBAC,
    - tenant-scoped API keys,
    - tenant-scoped rate limits,
    - storage-adapter-wide tenant enforcement.
## Security / Multi-Tenancy Update

Current status: partially closed, with important production gaps still open.

Closed in this phase:

- Tenant context foundation.
- Request identity contract.
- Request scope guard.
- Agent run tenant binding through `RequestIdentity`.
- WhatsApp replay tenant binding through `RequestIdentity`.
- WhatsApp journal tenant binding through `RequestIdentity`.
- Agent run scope enforcement: `agent:run`.
- WhatsApp replay scope enforcement: `replay:read`.
- WhatsApp journal scope enforcement: `journal:read`.
- Cross-tenant denial tests for replay.
- Cross-tenant denial tests for journal reads.

Still open:

- Real API key extraction from headers.
- API key verification against a configured or persisted registry.
- API key lifecycle: creation, revocation, rotation.
- RBAC / organization / user model.
- Storage-adapter-wide tenant isolation.
- Tenant-scoped rate limiting and quotas.
- Security audit event stream for authentication and authorization decisions.

Conclusion:

The project now has a defensible identity + tenant + scope foundation for selected HTTP paths, but it is not yet a complete production SaaS security model.
