# LLM/live contractual hardening

This document tracks the dedicated hardening suite for the `llm-live` planner path.

The suite is intentionally separate from the main contractual baseline.

## Commands

```powershell
npm run test:llm-live:contractual
npm run test:baseline:contractual
```

CI runs both suites as separate gates:

```text
Contractual baseline tests
LLM live contractual tests
```

## Current verified contracts

### 1. Capability synthesis pipeline

Contract:

```text
planner=llm-live
llmProvider=mock
goal=normalize extract merge user data
-> planId: agent-run-llm-live-mock-v1:cap-synth
-> finalState.values.merged contains deterministic merged user data
```

Hardening outcome:

```text
json/select-keys accepts resolved Json input from state.
This supports capability pipelines where json.extract produces an object and json.select consumes that object directly.
```

### 2. OpenAI-compatible provider missing configuration

Contract:

```text
planner=llm-live
llmProvider=openai-compatible
llmPlanText absent
provider config absent
-> HTTP 200
-> ok:false
-> error.code: LLM_LIVE_NOT_CONFIGURED
-> error.retryable:false
```

This prevents provider configuration mistakes from surfacing as generic 500 responses.

### 3. Invalid llmPlanText

Contract:

```text
planner=llm-live
llmProvider=openai-compatible
llmPlanText invalid JSON
-> HTTP 200
-> ok:false
-> error.code: LLM_LIVE_INVALID_PLAN_TEXT
-> error.retryable:false
```

This protects deterministic replay and debugging by returning a stable error envelope for invalid model materialization.

## Why this suite exists

The `llm-live` path is allowed to use provider-backed plan materialization, but execution must remain deterministic after the plan is materialized.

The hardening suite verifies:

- stable error envelopes
- deterministic mock-provider behavior
- deterministic stub-provider behavior through `llmPlanText`
- capability synthesis compatibility with resolved state values
- safe demo evidence for unconfigured real-provider paths

## Current status

```text
Main contractual baseline: 28 test files / 262 tests
LLM/live contractual suite: npm run test:llm-live:contractual
CI gate: enabled
```