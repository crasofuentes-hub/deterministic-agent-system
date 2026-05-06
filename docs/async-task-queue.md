# Async Task Queue

The project includes a domain-agnostic async task queue contract.

The queue layer exists to separate task orchestration semantics from concrete infrastructure such as Redis, BullMQ, Temporal, or local inline execution.

## Current status

Implemented:

- `AsyncTaskQueue` contract.
- `AsyncTaskHandler` contract.
- Deterministic task result shape.
- Inline async task queue adapter.
- Contractual tests for success, failure, explicit metadata, and invalid metadata.

Current implementation files:

    src/queue/types.ts
    src/queue/inline-task-queue.ts
    src/queue/index.ts

Current tests:

    tests/queue/inline-task-queue.test.ts

## Contract shape

A queue adapter must implement:

    AsyncTaskQueue

with this operation:

    enqueue(handler, input, options)

The handler owns:

    taskType
    handle(input, context)

The context includes deterministic execution metadata:

    jobId
    taskType
    enqueuedAtIso
    startedAtIso
    attempt

## Deterministic result contract

Queue execution returns a structured result instead of leaking task-specific exceptions as control flow.

Successful task result:

    ok: true
    status: "completed"
    output

Failed task result:

    ok: false
    status: "failed"
    error:
      name
      message

The inline adapter catches handler errors and returns deterministic failure payloads.

## Inline adapter

The inline adapter is intended for:

- local development
- deterministic tests
- pilots that do not need distributed workers yet
- validating queue semantics before adding external infrastructure

It executes the handler immediately in the same process while preserving the same public queue contract future adapters must implement.

## Future adapters

Future adapters should be added behind the same contract.

Expected future candidates:

- BullMQ + Redis adapter
- Temporal adapter
- durable Postgres-backed task adapter

Adapters must not change the public `AsyncTaskQueue` contract.

## Boundary rule

The core queue contract must not depend directly on BullMQ, Redis, Temporal, or any specific queue backend.

Infrastructure-specific packages belong in concrete adapter modules, not in `src/queue/types.ts`.