# Red Flags Status

This document maps common external review concerns to the current repository state.

## Red Flag 1: Core is too coupled to Insurance

Status:

    Mostly addressed.

Current evidence:

- domain extension contract exists
- insurance brokerage vertical extension exists
- architecture tests guard vertical boundaries
- README/docs clarify core vs vertical positioning

Representative areas:

    src/verticals
    src/insurance
    tests/architecture

Remaining work:

- keep insurance-specific behavior behind public vertical boundaries

Final audit guard:

    tests/architecture/core-vertical-import-audit.test.ts

## Red Flag 2: Postgres is not production-recommended

Status:

    Partially addressed and production direction is clear.

Current evidence:

- Postgres pool/config parsing exists
- Postgres migrations exist
- Postgres execution journal adapter exists
- async WhatsApp runtime can use Postgres
- Docker includes Postgres support
- storage docs describe production WhatsApp runtime

Representative areas:

    src/storage
    src/journal
    tests/storage
    tests/channels
    docker-compose.yml

Remaining work:

- consolidate global `storageMode` strategy across the full agent runtime
- make production-mode validation more explicit
- expose clearer startup messages for production storage configuration

## Red Flag 3: No async task queue abstraction

Status:

    Contract addressed; runtime adoption remains.

Current evidence:

- async task queue contract exists
- queue docs exist
- project has a clear adapter path for future external queues

Representative areas:

    src/queue
    docs

Remaining work:

- route one real long-running or async flow through the inline queue
- add future adapters only after the inline behavior is proven

## Red Flag 4: LLM-live prompting is weak or generic

Status:

    Addressed substantially.

Current evidence:

- planner prompt contracts are versioned
- planner prompt v1.1 exists
- v1.1 includes stronger role framing, delimiters, few-shot examples, and private self-check
- output validation rejects malformed planner outputs
- deterministic verifier rejects invented tools and invalid parameters
- verified planner boundary exists for LLM-live
- verified planner output bridges into `DeterministicAgentPlan`
- `/agent/run` supports explicit `planner-prompt-output` mode
- HTTP test proves the verified path

Representative areas:

    src/prompts
    src/planner
    src/agent-run
    tests/prompts
    tests/planner
    tests/agent-run
    tests/http.agent-run.llm-live.verified-planner-prompt.test.js

Remaining work:

- record prompt contract metadata in the journal
- add structured observability events for verified/rejected planner outputs
- expose verified planner metadata in agent run responses

## Red Flag 5: Journal / Replay is not strong enough

Status:

    Addressed substantially.

Current evidence:

- tamper-evident journal exists
- Postgres execution journal adapter exists
- replay engine exists
- replay endpoint exists
- bounded replay with `untilSequence` exists
- replay override exists
- replay rejects broken journal integrity

Representative areas:

    src/journal
    src/replay
    tests/replay
    tests/http

Remaining work:

- correlate planner prompt events with journal/replay
- add richer ops views for verified planner events

## Red Flag 6: Improvements are not visible in the repo

Status:

    This document and the current capabilities document address the visibility gap.

Public review entry points:

    README.md
    docs/current-platform-capabilities.md
    docs/red-flags-status.md

Recommended verification:

    npm run build
    npm run test:llm-live:contractual
    npm run test:baseline:contractual

## Current status matrix

See the current evaluator-facing status matrix:

    docs/red-flags-current-status.md
